---
name: nestjs-patterns
description: NestJS module architecture patterns — controllers, services, repositories, DTOs, guards, mappers, and module registration for production APIs
version: 1.0.0
filePattern: "**/*.module.ts,**/*.controller.ts,**/*.service.ts,**/*.repository.ts,**/*.guard.ts,**/*.mapper.ts,**/dto/**/*.ts"
risk_level: medium
writes_files: false
requires_tools: []
---

# NestJS Production Patterns

## Module Structure

Every feature is a self-contained NestJS module:

```
modules/<feature>/
  <feature>.module.ts           # Module definition (imports, providers, exports)
  <feature>.controller.ts       # HTTP handlers (REST endpoints)
  <feature>.service.ts          # Business logic (orchestration, validation)
  <feature>.repository.ts       # Data access (ORM queries only)
  <feature>.mapper.ts           # Entity <-> DTO transformation
  <feature>.constants.ts        # Queue names, job IDs, span names
  dto/                          # Zod-based request/response DTOs
    create-<feature>.dto.ts
    update-<feature>.dto.ts
  schemas/                      # Database type inference (insert/select)
    db-<feature>.ts
  <feature>.spec.ts             # Co-located unit tests
```

## Module Registration

```ts
@Module({
  imports: [DatabaseModule, OtherFeatureModule],
  providers: [FeatureService, FeatureRepository, FeatureMapper],
  controllers: [FeatureController],
  exports: [FeatureService, FeatureRepository], // Public API for other modules
})
export class FeatureModule {}
```

**Container modules** group related feature modules without their own logic:

```ts
@Module({
  imports: [UsersModule, PaymentsModule, AnalyticsModule],
  controllers: [BackofficeController], // Optional top-level controller
})
export class BackofficeModule {}
```

**Dynamic modules** for configurable services (e.g., email, SMS):

```ts
@Global()
@Module({})
export class EmailModule {
  static forRoot(options: EmailOptions): DynamicModule { /* ... */ }
  static forRootAsync(options: EmailAsyncOptions): DynamicModule { /* ... */ }
}
```

## Controllers

```ts
@ApiTags('Feature')
@ApiSecurity('application-oauth2')
@Controller('features')
export class FeatureController {
  constructor(private readonly service: FeatureService) {}

  @Get()
  @Version('1')
  @ApiOperation({ summary: 'List features' })
  @ZodResponse({ status: 200, type: FeatureListDto })
  async list(@Query() filter: FeatureFilterDto): Promise<FeatureListDto> {
    return this.service.findAll(filter);
  }

  @Post()
  @Version('1')
  @HttpCode(HttpStatus.CREATED)
  @Permissions(PermissionEnum.enum['feature:write'])
  @ZodResponse({ status: 201, type: FeatureDto })
  async create(@Body() dto: CreateFeatureDto): Promise<FeatureDto> {
    return this.service.create(dto);
  }

  @Get(':id')
  @Version('1')
  async findOne(@Param('id') id: string): Promise<FeatureDto> {
    return this.service.findById(id);
  }
}
```

**Decorator checklist for every endpoint:**
- `@Version('1')` — API versioning (URI-based)
- `@ApiOperation({ summary })` — Swagger docs
- `@ZodResponse({ status, type })` — Response validation + Swagger schema
- `@HttpCode()` — Override default status (201 for POST, 200 for others)
- `@Permissions()` + `@UseGuards(PermissionsGuard)` — Authorization
- `@Throttle({ name: { ttl, limit } })` — Rate limiting (override module default)
- `@Public()` — Skip authentication

**User context:** `@KeycloakUser() user: JwtToken` injects the authenticated user from JWT.

## Services

```ts
@Injectable()
export class FeatureService {
  private readonly logger = new Logger(FeatureService.name);

  constructor(
    private readonly repository: FeatureRepository,
    private readonly mapper: FeatureMapper,
  ) {}

  @Transactional()
  async create(dto: CreateFeatureDto): Promise<FeatureDto> {
    const entity = await this.repository.create(this.mapper.toInsert(dto));
    return this.mapper.toDto(entity);
  }
}
```

**Key patterns:**
- Logger: `new Logger(ClassName.name)` (or `OtelLogger` for trace-correlated logs)
- `@Transactional()` from `@nestjs-cls/transactional` for atomic operations
- Services orchestrate; repositories query; mappers transform
- Throw NestJS exceptions: `NotFoundException`, `BadRequestException`, `ConflictException`
- Never inject the database directly — always go through repositories

## Repositories (Drizzle ORM)

```ts
@Injectable()
export class FeatureRepository {
  constructor(private readonly txHost: TransactionHost<DbTransactionAdapter>) {}

  async findById(id: string) {
    const rows = await this.txHost.tx
      .select()
      .from(features)
      .where(eq(features.id, id))
      .limit(1);
    return rows.at(0) ?? null;
  }

  async create(data: InsertFeature) {
    const results = await this.txHost.tx
      .insert(features)
      .values(data)
      .returning();
    const created = results.at(0);
    if (!created) throw new Error('Failed to create feature');
    return created;
  }

  async findMany(filter: FeatureFilter): Promise<Result<SelectFeature>> {
    const where = and(
      filter.name ? ilike(features.name, `%${filter.name}%`) : undefined,
      filter.status ? eq(features.status, filter.status) : undefined,
    );
    const total = await this.txHost.tx.$count(features, where);
    const data = await this.txHost.tx
      .select()
      .from(features)
      .where(where)
      .limit(filter.limit)
      .offset(filter.offset)
      .orderBy(desc(features.createdAt));
    return { total, data };
  }

  async update(id: string, data: Partial<InsertFeature>) {
    const results = await this.txHost.tx
      .update(features)
      .set(data)
      .where(eq(features.id, id))
      .returning();
    return results.at(0) ?? null;
  }
}
```

**Conventions:**
- `TransactionHost<DbTransactionAdapter>` — transaction-aware via `@nestjs-cls/transactional`
- Access DB via `this.txHost.tx` (not a direct DB reference)
- Always `.returning()` on INSERT/UPDATE
- Use `rows.at(0) ?? null` for single-row queries (never `rows[0]`)
- `Result<T> = { total: number; data: T[] }` for paginated responses

## DTOs (Zod-based)

```ts
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const CreateFeatureSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  status: z.enum(['active', 'inactive']).default('active'),
});

export class CreateFeatureDto extends createZodDto(CreateFeatureSchema) {}
```

**For database types**, infer from Drizzle schema:

```ts
export type SelectFeature = typeof features.$inferSelect;
export type InsertFeature = typeof features.$inferInsert;
```

## Mappers

```ts
@Injectable()
export class FeatureMapper {
  toDto(entity: SelectFeature): FeatureDto {
    return {
      id: entity.id,
      name: entity.name,
      createdAt: entity.createdAt.toISOString(),
    };
  }

  toInsert(dto: CreateFeatureDto): InsertFeature {
    return {
      name: dto.name,
      description: dto.description ?? null,
    };
  }
}
```

**When to split mappers:** Separate `UserFeatureMapper` (mobile/public) from `FeatureMapper` (admin) when different consumers need different DTO shapes.

## Guards & Permissions

```ts
// Custom permission decorator
export const Permissions = (...perms: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, perms);

// Guard reads metadata and checks JWT roles
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.get<Permission[]>(PERMISSIONS_KEY, context.getHandler());
    if (!required?.length) return true;
    const user = context.switchToHttp().getRequest().user;
    return required.some(p => user.realm_access.roles.includes(p));
  }
}
```

## Global Providers (AppModule)

```ts
providers: [
  { provide: APP_FILTER, useClass: HttpExceptionFilter },
  { provide: APP_PIPE, useClass: ZodValidationPipe },
  { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
  { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  { provide: APP_GUARD, useClass: AuthGuard },
  { provide: APP_GUARD, useClass: ThrottlerGuard },
]
```

## Bootstrap (Fastify)

```ts
const app = await NestFactory.create<NestFastifyApplication>(
  AppModule,
  new FastifyAdapter({ querystringParser: qs.parse }),
);
app.enableCors({ origin: true, credentials: true });
app.setGlobalPrefix('api');
app.enableVersioning({ type: VersioningType.URI });
await app.register(helmet);
await app.register(multipart, { limits: { fileSize: MAX_FILE_SIZE } });
// Swagger setup...
await app.listen(PORT, '0.0.0.0');
```

## Constants File Pattern

```ts
// Queue name (BullModule.registerQueue + @InjectQueue)
export const FEATURE_QUEUE_NAME = 'feature-processing' as const;

// Job names (when enqueuing)
export const FeatureJobName = { PROCESS: 'process-feature' } as const;

// Job IDs (for deduplication)
export const FeatureJobId = { PROCESS: 'process-feature-job' } as const;

// OTel span names (dot-notation)
export const FeatureSpanName = { PROCESS: 'feature.process' } as const;
```

**Critical:** `@InjectQueue` must use the **queue name** constant, never a job-ID constant.

## Idempotency

For operations that may be retried (queue jobs, webhooks):
- Check for existing records before creating (e.g., `hasLedgerEntry(referenceId)`)
- Log duplicates as warnings, return early without error
- Use `jobId` in BullMQ for built-in deduplication
