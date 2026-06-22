## 1. your declared graded area (one of the four options above) and a one-sentence justification for why you chose it

v2/buildings and v2/rooms and a complete vertical slice of the application (routes → controller → service → repository) 
## 2.a brief overview of your architecture

Folder Structure

```text
src/
   App.ts                    # composition root: createApp, global middleware, mount routers
   index.ts
   routes/
      datasetsRoutes.ts
      searchRoutes.ts
      courseRoutes.ts
      buildingRoutes.ts
   models/
      building.ts
      room.ts
```

## 3. Pick your 4 required decisions

a. How will services access repositories?
Repository access: Dependency Injection.

For the `v2/buildings` and `v2/rooms` slice, each service receives repository dependencies through its constructor/function parameters instead of importing repositories directly. This keeps business logic decoupled from persistence details, makes services easier to unit test with mocked repositories, and supports cleaner separation of concerns in C3.

Tradeoff: dependency injection introduces more wiring code in the composition/root setup (for example in app initialization), so initial setup is slightly more verbose.

b. How will you structure validation?
Validation: Middleware-first validators

c. How will you represent domain errors?
Domain errors: Custom Error subclasses.

d How will you organize your modules?
Per-resource: courses, sections, buildings, rooms, datasets, search

## 4. a simple diagram or explanation of request flow

## 5. one “before vs after” example of a refactor you are proud of (provide a link to a specific commit on GitHub showing the diff)

Austin: 
Sam:

## 6. a short note on remaining technical debt or future improvements

One area for improvement by refactoring parts of the codebase into smaller, reusable components. The index.ts/app.ts sections were initially built in a single file, which can make debugging and scaling more difficult. Moving forward, I plan to improve the structure by adopting a more modular, component-based approach.
