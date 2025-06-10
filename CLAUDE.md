# Claude Code Rules for @d-zero-dev/tools

## Repository Structure

- This is a **monorepo** managed by Lerna
- Always work from the repository root (not individual package directories)
- Never work from individual package directories unless explicitly instructed

## Build and Test Commands

- **Always run commands from repository root**
- Use `yarn build` to build all packages via Lerna
- Use `yarn test` to run all tests via Vitest
- Use `yarn` (not `npm`) for all package management
- Volta manages Node.js and Yarn versions automatically via `package.json` volta section

## Package Architecture Rules

- **@d-zero/shared**: Uses individual export paths (e.g., `@d-zero/shared/config-reader`)
- **Never modify shared exports strategy** without explicit permission
- Respect existing export patterns in package.json

## Code Changes

- **Always read files first** before making any edits
- **Never make assumptions** about code structure or dependencies
- **Ask for permission** before making architectural changes
- Complete all related changes in a feature (don't leave tasks incomplete)

## CLI Patterns

- Use `@d-zero/cli-core` for common CLI functionality
- Follow established patterns for argument parsing and validation
- Maintain consistency across CLI tools

## Import/Export Guidelines

- Use specific import paths for `@d-zero/shared` (e.g., `/config-reader`)
- Check existing usage patterns before adding new dependencies
- Maintain backward compatibility with existing exports

## Error Prevention

- Test build and test commands after making changes
- Verify import paths are correct for the package export strategy
- Never commit without successful build and test results
