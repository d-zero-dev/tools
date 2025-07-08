# Claude Code Rules for @d-zero-dev/tools

## Repository Structure

- This is a **monorepo** managed by Lerna
- **Always work from the repository root** (not individual package directories)
- Volta manages Node.js and Yarn versions automatically via `package.json` volta section

## Development Workflow

### Build and Test Commands

- Use `yarn build` to build all packages via Lerna
- Use `yarn test` to run all tests via Vitest
- Use `yarn lint` to check for ESLint errors
- Use `yarn` (not `npm`) for all package management

### Quality Assurance Before Commit

- **Always run lint before commit**: Use `yarn lint` to check for ESLint errors and fix them before committing
- **Resolve ALL lint errors/warnings**: Never leave lint warnings unresolved, even if they seem harmless
- **Ask user permission before disabling ESLint rules**: Always ask the user before using eslint-disable-next-line or eslint-disable
- **Prefer code fixes over disabling**: Change code structure rather than disabling rules when possible
- **Justify disable usage**: When user approves disabling, explain why it's necessary and what alternatives were considered
- Test build and test commands after making changes
- Verify import paths are correct for the package export strategy
- Never commit without successful build and test results

### Commit Guidelines

- **Separate commit scope**: Don't mix implementation changes with documentation/rule updates in same commit
- Complete all related changes in a feature (don't leave tasks incomplete)

## Code Architecture

### Package Rules

- **@d-zero/shared**: Uses individual export paths (e.g., `@d-zero/shared/config-reader`)
- **Never modify shared exports strategy** without explicit permission
- Respect existing export patterns in package.json

### Import/Export Guidelines

- Use specific import paths for `@d-zero/shared` (e.g., `/config-reader`)
- Check existing usage patterns before adding new dependencies
- Maintain backward compatibility with existing exports

### CLI Patterns

- Use `@d-zero/cli-core` for common CLI functionality
- Follow established patterns for argument parsing and validation
- Maintain consistency across CLI tools

## Code Development

### General Principles

- **Always read files first** before making any edits
- **Never make assumptions** about code structure or dependencies
- **Ask for permission** before making architectural changes

### Error Handling Guidelines

- **Never suppress errors**: Don't use empty catch blocks or generic error swallowing
- **Specific error handling**: Handle specific error types with appropriate recovery strategies
- **Preserve error context**: Always maintain original error information when re-throwing
- **Log before throwing**: Use proper logging for debugging while preserving error propagation
- **Fail fast**: Let unhandled errors bubble up rather than attempting to continue in invalid state
- **Prefer .catch() for single awaits**: Use `.catch()` method instead of try-catch for single await expressions
- **Don't catch just to rethrow**: If you're only going to throw again, let the original error bubble up naturally
- **Avoid massive try blocks**: Break down large try blocks into smaller, more focused error handling

### Testing Guidelines

- **Test file naming**: Use `.spec.ts` extension and place next to source files (e.g., `foo.ts` → `foo.spec.ts`)
- **Test file location**: Always place test files adjacent to the source files they test
- **Test structure**: Follow AAA pattern (Arrange, Act, Assert)
- **Test principles**:
  - No conditionals (if/else/switch) in test code
  - No calculations or logic processing (except file paths)
  - No try/catch blocks in test code
  - Test one behavior per test case
- **Pure function testing**: Test without mocks when possible
- **Color output testing**: Verify ANSI escape sequences for terminal colors
- **Mock usage**: Use mocks for external dependencies, side effects, and uncontrollable inputs

## Package Version Management

- **Check latest version**: Use `npm view <package-name> version` (fastest and most accurate)
- **View version history**: Use `npm view <package-name> versions --json`
- **Check outdated packages**: Use `npm outdated` for project-wide check
- **Avoid web searches** for version checking - use npm commands directly
