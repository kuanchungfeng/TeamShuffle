# Project Tech Instructions

This project uses the following technologies and practices:

- **Angular**: The main frontend framework.
- **Standalone Components**: All Angular components are implemented as standalone components (no NgModules).  
    > Since Angular 20, standalone is the default; you do not need to add `standalone: true` in the component.
- **Signals**: Use Angular's signal API for state management and reactivity.
- **Angular Material**: For UI components and design consistency.
- **Tailwind CSS**: For utility-first CSS styling.
- **Bun**: As the JavaScript runtime and package manager.
- **SCSS**: Default styling language for components.

## Setup

1. **Install Bun**  
    Follow instructions at [https://bun.sh](https://bun.sh) to install Bun.

2. **Install Dependencies**  
    - bun install

3. **Angular Project Structure**  
    - Use `ng generate component --standalone --style=scss` to create new standalone components.
    - Each component must use an external **HTML file** (do not place HTML inline in the TypeScript file).
    - Use **services** to manage shared or component-level state.
    - Use Angular's `signal` API for reactive state.

4. **Angular Material**  
    - Import Angular Material components directly in standalone components.
    - Use Material theming as needed.

5. **Tailwind CSS**  
    - Tailwind is configured in `tailwind.config.js`.
    - Use Tailwind utility classes in templates for styling.

6. **Development**  
    - bun run start

## Best Practices

- Prefer signals over RxJS for local state.
- Compose UIs using Angular Material and Tailwind together.
- Keep components standalone for modularity and easier testing.
- Use **services** for state management and business logic.
- Always use **external HTML and SCSS files** for component templates and styles.
