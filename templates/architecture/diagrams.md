# Diagram Starters — <name>

Mermaid renders in GitHub, most IDEs, and many docs tools. Keep node labels free
of angle brackets. Prefer a few clear views over one dense diagram. Show an
**as-is** view first when the client has an existing system, then the **to-be**.

## System context (who/what touches the system)

```mermaid
flowchart LR
  user[End user]
  admin[Admin]
  sys[New system]
  idp[Identity provider]
  erp[Client ERP/CRM]
  user --> sys
  admin --> sys
  sys --> idp
  sys --> erp
```

## Containers (apps, services, stores)

```mermaid
flowchart TB
  web[Web app] --> api[API]
  mobile[Mobile app] --> api
  api --> db[(Primary DB)]
  api --> cache[(Cache)]
  api --> queue[[Message queue]]
  queue --> worker[Worker]
```

## Key sequence (a critical flow)

```mermaid
sequenceDiagram
  participant U as User
  participant A as API
  participant D as Database
  U->>A: request
  A->>D: read/write
  D-->>A: result
  A-->>U: response
```

## Deployment (where it runs)

```mermaid
flowchart LR
  cdn[CDN] --> edge[Edge/LB]
  edge --> svc[App instances]
  svc --> dbp[(Managed DB primary)]
  dbp --> dbr[(Read replica)]
```

## Data model (when data shape matters)

```mermaid
erDiagram
  CUSTOMER ||--o{ ORDER : places
  ORDER ||--|{ ORDER_ITEM : contains
  PRODUCT ||--o{ ORDER_ITEM : "ordered in"
```

For formal C4 diagrams, mermaid also supports `C4Context` / `C4Container`; use
them if your renderer does. Otherwise the flowcharts above are portable.
