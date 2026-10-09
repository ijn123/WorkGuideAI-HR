// Replace external SDKs, never application providers. Unexpected calls fail closed.
const state = {};

function reset() {
    Object.assign(state, {
        decision: undefined, routingError: false, answer: undefined, generationError: false,
        points: undefined, vectorError: false, calls: [],
    });
}
reset();

class ChatGoogle {
    pipe() {
        return { invoke: async messages => {
            if (!Array.isArray(messages) || messages.length !== 2) throw new Error('Unexpected Gemini invocation.');
            const input = JSON.parse(messages[1].content);
            const kind = Object.hasOwn(input, 'currentYear') ? 'routing' : 'generation';
            state.calls.push({ kind, input });
            const reply = kind === 'routing' ? state.decision : state.answer;
            if ((kind === 'routing' ? state.routingError : state.generationError) || reply === undefined) {
                throw new Error('Simulated external Gemini failure.');
            }
            return typeof reply === 'string' ? reply : JSON.stringify(reply);
        } };
    }
}

class GoogleGenerativeAIEmbeddings {
    async embedQuery(input) {
        state.calls.push({ kind: 'embedding', input });
        if (state.points === undefined) throw new Error('Unexpected embedding invocation.');
        return [1, 0, 0, 0, 0, 0, 0, 0];
    }
}

class QdrantClient {
    async query(collection, input) {
        state.calls.push({ kind: 'vector', collection, input });
        if (state.vectorError || state.points === undefined) throw new Error('Simulated external Qdrant failure.');
        return { points: state.points };
    }
}

module.exports = { state, reset, ChatGoogle, GoogleGenerativeAIEmbeddings, QdrantClient };
