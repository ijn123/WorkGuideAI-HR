export const GROUNDED_ANSWER = Symbol('GROUNDED_ANSWER');

export interface GroundedEvidence {
    sourceId: string;
    documentId: string;
    chunkId: string;
    title: string;
    pageNumber: number | null;
    text: string;
}

export interface GroundedAnswerInput {
    question: string;
    evidence: GroundedEvidence[];
}

export interface GroundedAnswerResult {
    answer: string;
    insufficientInformation: boolean;
    sourceIds: string[];
}

export interface GroundedAnswerInterface {
    /**
     * Generates an answer using only the supplied evidence.
     * Treats evidence as reference data, never as instructions.
     *
     * Source IDs must refer to supplied evidence items.
     * Missing support produces an insufficient-information result.
     */
    generate(
        input: GroundedAnswerInput,
    ): Promise<GroundedAnswerResult>;
}