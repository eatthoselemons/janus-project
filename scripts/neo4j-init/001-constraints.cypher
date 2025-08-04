// Create constraints for unique IDs across all entity types
CREATE CONSTRAINT content_node_id_unique IF NOT EXISTS FOR (n:ContentNode) REQUIRE n.id IS UNIQUE;
CREATE CONSTRAINT content_node_name_unique IF NOT EXISTS FOR (n:ContentNode) REQUIRE n.name IS UNIQUE;
CREATE CONSTRAINT content_version_id_unique IF NOT EXISTS FOR (v:ContentNodeVersion) REQUIRE v.id IS UNIQUE;

CREATE CONSTRAINT test_case_id_unique IF NOT EXISTS FOR (t:TestCase) REQUIRE t.id IS UNIQUE;

CREATE CONSTRAINT test_run_id_unique IF NOT EXISTS FOR (tr:TestRun) REQUIRE tr.id IS UNIQUE;
CREATE CONSTRAINT data_point_id_unique IF NOT EXISTS FOR (dp:DataPoint) REQUIRE dp.id IS UNIQUE;

CREATE CONSTRAINT tag_id_unique IF NOT EXISTS FOR (t:Tag) REQUIRE t.id IS UNIQUE;
CREATE CONSTRAINT tag_name_unique IF NOT EXISTS FOR (t:Tag) REQUIRE t.name IS UNIQUE;

// Create indexes for performance on commonly queried properties
CREATE INDEX content_node_name_index IF NOT EXISTS FOR (n:ContentNode) ON (n.name);
CREATE INDEX content_node_description_index IF NOT EXISTS FOR (n:ContentNode) ON (n.description);
CREATE INDEX test_case_name_index IF NOT EXISTS FOR (t:TestCase) ON (t.name);
CREATE INDEX test_case_model_index IF NOT EXISTS FOR (t:TestCase) ON (t.llmModel);
CREATE INDEX tag_name_index IF NOT EXISTS FOR (t:Tag) ON (t.name);

// Create indexes for temporal queries
CREATE INDEX content_version_created_at_index IF NOT EXISTS FOR (v:ContentNodeVersion) ON (v.createdAt);
CREATE INDEX test_run_created_at_index IF NOT EXISTS FOR (tr:TestRun) ON (tr.createdAt);
