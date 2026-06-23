---
name: external-service-patterns
description: External service integration patterns — SFTP connections, payment gateways, Keycloak auth, HTTP clients with resilience, and provider isolation
version: 1.0.0
filePattern: "**/external/**,**/sftp/**,**/keycloak/**,**/payment/**,**/*provider*"
bashPattern: "sftp|keycloak|paygate|payment|webhook"
---

# External Service Integration Patterns

## Provider Isolation

External services live under `modules/external/<provider>/`:

```
modules/external/
  payment/
    paygate/
      paygate-payment.service.ts     # Payment initialization (Phase 1a)
      paygate-capture.service.ts     # Capture/cancel/refund
      paygate-callback.service.ts    # Webhook handling
      dto/
        enrol.dto.ts
        capture.dto.ts
    payment.module.ts                 # Exports all payment services
  email/
    mailjet/
      mailjet.service.ts
      mailjet.module.ts
  sms/
    twilio/
      twilio.service.ts
```

**Principle:** Isolate provider-specific code. Business logic in `modules/<feature>/` only calls the provider abstraction, never the raw API.

## SFTP Connection Pattern

```ts
@Injectable()
export class SftpWrapperService implements OnModuleDestroy {
  private client: SFTPWrapper | null = null;
  private connectPromise: Promise<void> | null = null;
  private readonly logger = new Logger(SftpWrapperService.name);

  constructor(private readonly config: SftpConfig) {}

  async getBuffer(filePath: string): Promise<Buffer> {
    await this.ensureConnected();
    return this.client!.get(filePath) as Promise<Buffer>;
  }

  private async ensureConnected(): Promise<void> {
    if (this.client) return;

    // Coalesce concurrent connection attempts
    if (!this.connectPromise) {
      this.connectPromise = this.connect();
    }
    return this.connectPromise;
  }

  private async connect(): Promise<void> {
    try {
      this.client = new SFTPClient();
      await this.client.connect({
        host: this.config.host,
        port: this.config.port ?? 22,
        username: this.config.username,
        password: this.config.password,
      });

      // Auto-reconnect on disconnect
      this.client.on('error', () => { this.client = null; this.connectPromise = null; });
      this.client.on('end', () => { this.client = null; this.connectPromise = null; });
    } catch (error) {
      this.client = null;
      this.connectPromise = null;
      throw error;
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.end().catch(() => {});
      this.client = null;
    }
  }
}
```

**Key patterns:**
- Lazy connection (connect on first use, not on startup)
- Promise coalescing (prevent parallel connection storms)
- Event-based disconnect detection (auto-reconnect on next call)
- `onModuleDestroy` for clean shutdown
- Always wrap `end()` in `.catch(() => {})` to prevent swallowed errors

**Usage with resilience:**
```ts
onModuleInit() {
  this.sftpPolicy = this.resilience.createPolicy('sftp', {
    circuitBreaker: { failureThreshold: 3, openDuration: 60_000 },
    retry: { maxAttempts: 3, delay: 2_000 },
  });
}

async fetchFile(path: string): Promise<Buffer> {
  return this.sftpPolicy.execute(() => this.sftp.getBuffer(path));
}
```

## Payment Gateway Integration

### Phase Pattern (Multi-Step Payment)

```
Phase 1a: Server -> Gateway    (initialize, get payment token)
Phase 1b: Client -> Gateway    (3DS authentication, card input)
Phase 2:  Gateway -> Server    (callback with result)
Phase 3:  Server -> Gateway    (capture / cancel / refund)
```

### Service Structure

```ts
// External provider service — raw API calls only
@Injectable()
export class PaymentProviderService {
  constructor(
    private readonly httpClient: HttpService,
    @Inject(PAYMENT_CONFIG) private readonly config: PaymentConfig,
  ) {}

  async initPhase1a(dto: InitPaymentDto): Promise<PaymentToken> {
    const body = this.buildRequestBody(dto);
    const mac = this.computeHmac(body);
    const response = await this.httpClient.post(this.config.url, { ...body, MAC: mac });
    return response.data;
  }

  // HMAC security seal
  private computeHmac(body: Record<string, unknown>): string {
    const sortedFields = Object.keys(body).sort().map(k => `${k}=${body[k]}`).join('*');
    return crypto.createHmac('sha1', this.config.securityKey).update(sortedFields).digest('hex');
  }
}

// Internal orchestration service — business logic
@Injectable()
export class PaymentService {
  constructor(
    private readonly provider: PaymentProviderService,
    private readonly repository: PaymentRepository,
    private readonly loyaltyQueue: Queue,
  ) {}

  @Transactional()
  async initiatePayment(userId: string, dto: PaymentDto): Promise<PaymentResult> {
    const reference = this.generateReference();
    const payment = await this.repository.create({
      reference,
      userId,
      amountInMinor: dto.amountInMinor,
      status: 'pending',
    });
    const token = await this.provider.initPhase1a({
      reference,
      amountInMinor: dto.amountInMinor,
      currency: 'EUR',
    });
    await this.repository.updateToken(payment.id, token);
    return { paymentToken: token, reference };
  }
}
```

### Capture/Refund Amount Arithmetic

For gateways with multi-amount validation (e.g., Paygate):

```ts
// Four amounts must sum correctly: montant = a_capturer + deja_capture + restant
function buildCaptureRequest(payment: Payment, refundAmount: number) {
  const totalCaptured = payment.amountInMinor - refundAmount;
  return {
    montant: formatAmount(payment.amountInMinor, 'EUR'),           // Original total
    montant_a_capturer: formatAmount(0, 'EUR'),                     // Nothing new to capture
    montant_deja_capture: formatAmount(totalCaptured, 'EUR'),       // What remains captured
    montant_restant: formatAmount(totalCaptured, 'EUR'),            // Remaining
  };
}

function formatAmount(minorUnits: number, currency: string): string {
  return `${(minorUnits / 100).toFixed(2)}${currency}`;  // e.g., "50.00EUR"
}
```

### Webhook Callback Handling

```ts
@Post('callback')
@Public()  // Webhooks don't have JWT
@HttpCode(HttpStatus.OK)
async handleCallback(@Body() body: CallbackDto): Promise<string> {
  const isValid = this.provider.verifySignature(body);
  if (!isValid) throw new BadRequestException('Invalid signature');

  await this.paymentService.processCallback(body.reference, body.status);
  return 'OK';  // Gateway expects acknowledgment
}
```

## Keycloak Authentication

### Multi-Tenant Config

```ts
@Injectable()
export class KeycloakConfigService implements KeycloakConnectOptionsFactory {
  constructor(private readonly configService: ConfigService) {}

  createKeycloakConnectOptions(): KeycloakConnectOptions {
    return {
      authServerUrl: this.configService.get('KEYCLOAK_URL'),
      realm: this.configService.get('KEYCLOAK_REALM'),
      clientId: this.configService.get('KEYCLOAK_CLIENT_ID'),
      secret: this.configService.get('KEYCLOAK_SECRET'),
      policyEnforcement: PolicyEnforcementMode.PERMISSIVE,
      tokenValidation: TokenValidation.ONLINE,
    };
  }
}
```

### Guards Stack (order matters)

```ts
// AppModule providers — evaluated top to bottom
{ provide: APP_GUARD, useClass: AuthGuard },       // 1. Verify JWT
{ provide: APP_GUARD, useClass: ResourceGuard },    // 2. Check resource access
{ provide: APP_GUARD, useClass: ThrottlerGuard },   // 3. Rate limiting
// Custom PermissionsGuard applied per-controller via @UseGuards()
```

### Custom Permissions (workaround for multi-tenant bugs)

```ts
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.get<Permission[]>(
      PERMISSIONS_KEY,
      context.getHandler(),
    );
    if (!required?.length) return true;

    const request = context.switchToHttp().getRequest();
    const parseResult = UserSchema.safeParse(request.user);
    if (!parseResult.success) return false;

    return required.some(p =>
      parseResult.data.realm_access.roles.includes(p),
    );
  }
}
```

### User extraction

```ts
// Decorator
export const KeycloakUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) =>
    ctx.switchToHttp().getRequest().user,
);

// Usage
@Get('me')
async getProfile(@KeycloakUser() user: JwtToken): Promise<UserDto> {
  return this.service.findByKeycloakId(user.sub);
}
```

## HTTP Client Pattern (Axios + Resilience)

```ts
@Injectable()
export class ExternalApiClient implements OnModuleInit {
  private policy!: ResiliencePolicy;

  constructor(
    private readonly http: HttpService,
    private readonly resilience: ResilienceService,
    private readonly logger: OtelLogger,
  ) {}

  onModuleInit() {
    this.policy = this.resilience.createPolicy('external-api', {
      circuitBreaker: { failureThreshold: 5, openDuration: 30_000 },
      retry: { maxAttempts: 2, delay: 1_000 },
    });
  }

  async get<T>(path: string): Promise<T> {
    return this.policy.execute(async () => {
      const response = await firstValueFrom(
        this.http.get<T>(path).pipe(
          catchError((error: AxiosError) => {
            this.logger.error(`External API error: ${error.message}`, error.stack);
            throw error;
          }),
        ),
      );
      return response.data;
    });
  }
}
```

## Config Pattern (Environment Variables)

```ts
// Typed config
export interface PaymentConfig {
  url: string;
  merchantId: string;
  securityKey: string;
  sandbox: boolean;
}

// Provider
export const PAYMENT_CONFIG = Symbol('PAYMENT_CONFIG');

export const paymentConfigProvider: Provider = {
  provide: PAYMENT_CONFIG,
  useFactory: (config: ConfigService): PaymentConfig => ({
    url: config.getOrThrow('PAYMENT_URL'),
    merchantId: config.getOrThrow('PAYMENT_MERCHANT_ID'),
    securityKey: config.getOrThrow('PAYMENT_SECURITY_KEY'),
    sandbox: config.get('PAYMENT_SANDBOX', 'false') === 'true',
  }),
  inject: [ConfigService],
};
```

Always `getOrThrow()` for required config — fail fast at startup, not at runtime.
