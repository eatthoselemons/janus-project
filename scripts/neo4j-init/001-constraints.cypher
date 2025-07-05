// Create constraints for unique IDs across all entity types
CREATE CONSTRAINT snippet_id_unique IF NOT EXISTS FOR (s:Snippet) REQUIRE s.id IS UNIQUE;
CREATE CONSTRAINT snippet_name_unique IF NOT EXISTS FOR (s:Snippet) REQUIRE s.name IS UNIQUE;
CREATE CONSTRAINT snippet_version_id_unique IF NOT EXISTS FOR (sv:SnippetVersion) REQUIRE sv.id IS UNIQUE;

CREATE CONSTRAINT composition_id_unique IF NOT EXISTS FOR (c:Composition) REQUIRE c.id IS UNIQUE;
CREATE CONSTRAINT composition_name_unique IF NOT EXISTS FOR (c:Composition) REQUIRE c.name IS UNIQUE;
CREATE CONSTRAINT composition_version_id_unique IF NOT EXISTS FOR (cv:CompositionVersion) REQUIRE cv.id IS UNIQUE;

CREATE CONSTRAINT parameter_id_unique IF NOT EXISTS FOR (p:Parameter) REQUIRE p.id IS UNIQUE;
CREATE CONSTRAINT parameter_name_unique IF NOT EXISTS FOR (p:Parameter) REQUIRE p.name IS UNIQUE;
CREATE CONSTRAINT parameter_option_id_unique IF NOT EXISTS FOR (po:ParameterOption) REQUIRE po.id IS UNIQUE;

CREATE CONSTRAINT test_run_id_unique IF NOT EXISTS FOR (tr:TestRun) REQUIRE tr.id IS UNIQUE;
CREATE CONSTRAINT data_point_id_unique IF NOT EXISTS FOR (dp:DataPoint) REQUIRE dp.id IS UNIQUE;

CREATE CONSTRAINT tag_id_unique IF NOT EXISTS FOR (t:Tag) REQUIRE t.id IS UNIQUE;
CREATE CONSTRAINT tag_name_unique IF NOT EXISTS FOR (t:Tag) REQUIRE t.name IS UNIQUE;

// Create indexes for performance on commonly queried properties
CREATE INDEX snippet_name_index IF NOT EXISTS FOR (s:Snippet) ON (s.name);
CREATE INDEX composition_name_index IF NOT EXISTS FOR (c:Composition) ON (c.name);
CREATE INDEX parameter_name_index IF NOT EXISTS FOR (p:Parameter) ON (p.name);
CREATE INDEX tag_name_index IF NOT EXISTS FOR (t:Tag) ON (t.name);

// Create indexes for temporal queries
CREATE INDEX snippet_version_created_at_index IF NOT EXISTS FOR (sv:SnippetVersion) ON (sv.createdAt);
CREATE INDEX composition_version_created_at_index IF NOT EXISTS FOR (cv:CompositionVersion) ON (cv.createdAt);
CREATE INDEX parameter_option_created_at_index IF NOT EXISTS FOR (po:ParameterOption) ON (po.createdAt);
CREATE INDEX test_run_created_at_index IF NOT EXISTS FOR (tr:TestRun) ON (tr.createdAt);
