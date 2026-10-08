BEGIN;

ALTER TABLE documents
    ADD COLUMN indexing_status VARCHAR(20) NOT NULL
        DEFAULT 'pending',
    ADD COLUMN indexing_generation UUID,
    ADD COLUMN indexed_at TIMESTAMPTZ,
    ADD COLUMN indexing_error TEXT;

ALTER TABLE documents
    ADD CONSTRAINT documents_indexing_status_check
        CHECK (
            indexing_status IN (
                                'pending',
                                'indexing',
                                'ready',
                                'failed'
                )
            ),
    ADD CONSTRAINT documents_ready_index_check
        CHECK (
            indexing_status <> 'ready'
            OR (
                indexing_generation IS NOT NULL
                AND indexed_at IS NOT NULL
            )
        );

COMMIT;
