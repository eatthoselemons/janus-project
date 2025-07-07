# Janus Project - Development TODO

Based on analysis of the design documents and current codebase, this document outlines what remains to be implemented to have a fully functional CLI application.

## 📊 Current Status

✅ **Completed:**
- Domain models with branded types and validation
- Pure business logic calculations 
- Neo4j database service with Effect-TS patterns
- Repository layer (Snippet, Composition)
- Database migrations and schema
- Configuration management
- Comprehensive test infrastructure (300+ tests)
- CLI command structure skeleton
- Basic entry point

❌ **Missing:** Core business services, CLI implementations, LLM integration, export system

---

## 🚀 Critical Path to Working CLI

### Phase 1: Complete Repository Layer
**Priority: HIGH** - Required for all other functionality

- [ ] **Parameter Repository** (`src/db/repositories/parameter.ts`)
  - [ ] Parameter CRUD operations
  - [ ] Parameter option management
  - [ ] Tests with expected/edge/failure cases

- [ ] **TestRun Repository** (`src/db/repositories/test-run.ts`)
  - [ ] TestRun CRUD operations  
  - [ ] DataPoint management
  - [ ] Relationship queries for test results
  - [ ] Tests with expected/edge/failure cases

- [ ] **Tag Repository** (`src/db/repositories/tag.ts`)
  - [ ] Tag CRUD operations
  - [ ] Entity tagging relationships
  - [ ] Tag-based queries for composition assembly
  - [ ] Tests with expected/edge/failure cases

- [ ] **Versioning Support in Repositories**
  - [ ] VERSION_OF and PREVIOUS_VERSION relationship management
  - [ ] Latest version queries
  - [ ] Version history traversal
  - [ ] Version comparison utilities

### Phase 2: Business Logic Services
**Priority: HIGH** - Coordinates repository operations

- [ ] **Snippet Service** (`src/services/snippet-service.ts`)
  - [ ] Create/update snippet with automatic versioning
  - [ ] Content hash calculation and deduplication
  - [ ] Git-like pull/push operations
  - [ ] Parameter extraction from snippet content
  - [ ] Tests with mock repositories

- [ ] **Composition Service** (`src/services/composition-service.ts`)
  - [ ] Create composition versions from existing compositions
  - [ ] Declarative composition assembly from tags/rules
  - [ ] Snippet inclusion/exclusion logic
  - [ ] Composition validation and conflict resolution
  - [ ] Tests with mock repositories

- [ ] **Parameter Service** (`src/services/parameter-service.ts`)
  - [ ] Parameter definition management
  - [ ] Parameter option versioning
  - [ ] Parameter validation and type checking
  - [ ] Tests with mock repositories

- [ ] **Template Service** (`src/services/template-service.ts`)
  - [ ] Parameter injection into snippet content ({{parameter_name}})
  - [ ] Template validation (ensure all parameters are defined)
  - [ ] Final prompt assembly from composition + parameters
  - [ ] Template syntax error handling
  - [ ] Tests with various template scenarios

### Phase 3: CLI Command Implementations
**Priority: HIGH** - User interface layer

- [ ] **Workspace Management** (`src/services/workspace-service.ts`)
  - [ ] Local `janus_workspace/` directory management
  - [ ] File read/write operations with proper error handling
  - [ ] Workspace initialization and cleanup
  - [ ] Tests with filesystem mocking

- [ ] **Snippet CLI Commands** (`src/cli/commands/snippet.ts`)
  - [ ] `janus snippet pull <name>` - Download snippet to local file
  - [ ] `janus snippet push <file> -m <message>` - Upload file changes
  - [ ] `janus snippet list` - Show all snippets with descriptions
  - [ ] `janus snippet search <query>` - Vector search (placeholder for MVP)
  - [ ] Integration tests with real CLI parsing

- [ ] **Composition CLI Commands** (`src/cli/commands/composition.ts`)
  - [ ] `janus composition create-version` with --from-composition/--from-group
  - [ ] `janus composition list` - Show all compositions
  - [ ] YAML-based declarative composition support
  - [ ] Integration tests with real CLI parsing

- [ ] **Parameter CLI Commands** (`src/cli/commands/parameter.ts`)
  - [ ] `janus parameter create <name> --description <desc>`
  - [ ] `janus parameter add-option --parameter-name <name> <value> -m <message>`
  - [ ] `janus parameter list` and `janus parameter list-options <name>`
  - [ ] Integration tests with real CLI parsing

- [ ] **Database CLI Commands** (`src/cli/commands/database.ts`)
  - [ ] `janus db init` - Run initial setup
  - [ ] `janus db migrate` - Run migration system
  - [ ] `janus db rollback` - Rollback migrations
  - [ ] `janus db status` - Check database health
  - [ ] Integration tests with test database

### Phase 4: Test Execution System
**Priority: MEDIUM** - Core experimentation functionality

- [ ] **Test Config Parser** (`src/services/test-config-service.ts`)
  - [ ] YAML parsing for test_config.yaml format
  - [ ] Test matrix generation from parameter arrays
  - [ ] Composition resolution (ID vs declarative)
  - [ ] Configuration validation and error reporting
  - [ ] Tests with various config scenarios

- [ ] **LLM Integration** (`src/services/llm/`)
  - [ ] **Base LLM Service** (`base-llm-service.ts`)
    - [ ] Common interface for all LLM providers
    - [ ] Request/response standardization
    - [ ] Error handling and retries
    - [ ] Token counting and metrics collection
  
  - [ ] **OpenAI Provider** (`openai-provider.ts`)
    - [ ] OpenAI API integration with HTTP client
    - [ ] Model-specific configurations
    - [ ] Rate limiting and cost tracking
    - [ ] Tests with mocked HTTP responses
  
  - [ ] **Anthropic Provider** (`anthropic-provider.ts`)
    - [ ] Anthropic API integration
    - [ ] Claude-specific handling
    - [ ] Tests with mocked HTTP responses

  - [ ] **Google Provider** (`gemini-provider.ts`)
    - [ ] Gemini API integration
    - [ ] Gemini-specific handling
    - [ ] Tests with mocked HTTP responses
    
- [ ] **Test Execution Service** (`src/services/test-execution-service.ts`)
  - [ ] Test matrix execution coordination
  - [ ] Parallel/sequential execution strategies
  - [ ] Progress reporting and logging
  - [ ] Result aggregation and storage
  - [ ] Error handling and partial failure recovery
  - [ ] Tests with mocked LLM providers

- [ ] **Test Run CLI Command** (`src/cli/commands/run.ts`)
  - [ ] `janus run <config-file>` - Execute test suite
  - [ ] Progress indicators and real-time feedback
  - [ ] Result summary and storage confirmation
  - [ ] Integration tests with sample configs

### Phase 5: Export/Import System
**Priority: LOW** - Data portability

- [ ] **Export Service** (`src/services/export-service.ts`)
  - [ ] Graph traversal from TestRun to all related entities
  - [ ] JSON export format generation per specification
  - [ ] Relationship serialization
  - [ ] Large export handling and streaming
  - [ ] Tests with complex experiment graphs

- [ ] **Import Service** (`src/services/import-service.ts`)
  - [ ] JSON import parsing and validation
  - [ ] Conflict detection (same ID, different content)
  - [ ] Namespace prefix application for conflicts
  - [ ] Entity and relationship reconstruction
  - [ ] Import transaction safety (all-or-nothing)
  - [ ] Tests with conflict scenarios

- [ ] **Export/Import CLI Commands** (`src/cli/commands/export-import.ts`)
  - [ ] `janus export --run-id <id> --output <file>`
  - [ ] `janus import <file> --conflict-namespace <prefix>`
  - [ ] Progress indicators for large operations
  - [ ] Integration tests with real files

---

## 🔧 Technical Infrastructure Improvements

### Enhanced Repository Features
- [ ] **Database Connection Pooling**
  - [ ] Production-ready connection management
  - [ ] Connection health checks and reconnection
  - [ ] Proper resource cleanup

- [ ] **Advanced Query Optimization**
  - [ ] Indexed queries for common operations
  - [ ] Bulk operations for large datasets
  - [ ] Query performance monitoring

### Error Handling & Logging
- [ ] **Structured Logging** (`src/services/logging-service.ts`)
  - [ ] Consistent log formatting across all services
  - [ ] Log levels and filtering
  - [ ] Performance metrics collection

- [ ] **Enhanced Error Types**
  - [ ] User-friendly error messages for CLI
  - [ ] Error recovery suggestions
  - [ ] Detailed error context for debugging

### Configuration & Environment
- [ ] **Environment-specific Configurations**
  - [ ] Development, testing, production configs
  - [ ] Secret management for LLM API keys
  - [ ] Feature flags for experimental functionality

---

## 📋 Development Workflow Improvements

### Testing Strategy
- [ ] **Integration Test Suite**
  - [ ] End-to-end CLI command testing
  - [ ] Database integration testing with real Neo4j
  - [ ] LLM provider integration testing (with mocks)

- [ ] **Performance Testing**
  - [ ] Large dataset handling
  - [ ] Concurrent operation testing
  - [ ] Memory usage profiling

### Developer Experience
- [ ] **CLI Development Tools**
  - [ ] Hot reloading for development
  - [ ] Debug mode with verbose logging
  - [ ] CLI autocomplete support

- [ ] **Documentation**
  - [ ] API documentation for all services
  - [ ] CLI usage examples and tutorials
  - [ ] Architecture decision records

---

## 🎯 MVP Milestone Checklist

For a **minimum viable CLI application**, the following must be completed:

### Core MVP Features ✅
- [x] Domain models and validation
- [x] Database layer with Neo4j
- [x] Basic repository operations
- [ ] **Snippet management** (pull/push workflow)
- [ ] **Basic composition creation**
- [ ] **Parameter definition and management**
- [ ] **Simple test execution** (manual composition + single LLM)
- [ ] **Database initialization and migrations**

### MVP Commands Required
- [ ] `janus db init` - Setup database
- [ ] `janus snippet pull/push/list` - Snippet management
- [ ] `janus parameter create/add-option/list` - Parameter management  
- [ ] `janus composition create-version/list` - Composition management
- [ ] `janus run <config>` - Basic test execution

### MVP Test Config Support
- [ ] Simple YAML parsing
- [ ] Single LLM provider (OpenAI or Anthropic)
- [ ] Basic parameter injection
- [ ] Result storage in database

---

## 🔄 Recommended Development Order

1. **Complete Repository Layer** (Parameter, TestRun, Tag repos)
2. **Build Template Service** (parameter injection)
3. **Implement Snippet Service + CLI** (pull/push workflow)
4. **Add Parameter Service + CLI** (parameter management)
5. **Create simple LLM provider** (OpenAI)
6. **Build Test Config Parser** (YAML support)
7. **Implement Test Execution Service**
8. **Add Run CLI command**
9. **Enhance with Composition Service**
10. **Add Export/Import as final feature**

This order ensures each component can be tested independently and builds toward a working MVP incrementally.

---

**Estimated MVP Completion:** 2-3 weeks of focused development
**Full Feature Completion:** 4-6 weeks of focused development

The project has excellent foundations with proper Effect-TS patterns, comprehensive testing, and clean architecture. The remaining work is primarily implementing business logic and connecting the pieces together.