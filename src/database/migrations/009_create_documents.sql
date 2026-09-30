BEGIN;

CREATE TABLE documents (
                           id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

                           title TEXT NOT NULL
                               CHECK (length(trim(title)) > 0),

                           status VARCHAR(20) NOT NULL DEFAULT 'draft'
                               CHECK (status IN ('draft', 'published', 'archived')),

                           allowed_roles TEXT[] NOT NULL
        CHECK (
            cardinality(allowed_roles) > 0
            AND allowed_roles <@ ARRAY[
                'employee', 'hr', 'admin'
            ]::TEXT[]
            AND array_position(allowed_roles, NULL) IS NULL
        ),

                           created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMIT;