---
id: parcus-nestjs-module-structure
trigger: 'when creating a new NestJS module or feature'
confidence: 0.95
domain: nestjs
source: local-repo-analysis
---

# Follow NestJS Module File Naming Convention

## Action

When creating a new NestJS module, always follow this file structure:

```
<feature>/
├── <feature>.module.ts
├── <feature>.service.ts
├── <feature>.service.spec.ts
├── <feature>.repository.ts        (if data access needed)
├── <feature>.repository.spec.ts
├── <feature>.controller.ts        (if HTTP endpoints needed)
├── <feature>.controller.spec.ts
├── <feature>.mapper.ts            (if DTO mapping needed)
├── <feature>.mapper.spec.ts
├── <feature>.constants.ts         (if BullMQ/spans needed)
├── <feature>.processor.ts         (if background jobs needed)
├── <feature>.processor.spec.ts
└── schemas/
    └── db-<entity>.ts
```

All spec files are colocated next to their source files.

## Evidence

- Analyzed 18 modules under `apps/api/src/modules/`
- 100% follow this naming convention
- 51 colocated `.spec.ts` files across the codebase
