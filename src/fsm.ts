import Base from './base';
import Signal from './signal';

export interface FSMChangeEvent<State extends string, Event extends string> {
    from: State;
    to: State;
    event: Event;
}

export default class FSM<State extends string, Event extends string> extends Base {
    public readonly change: Signal<FSMChangeEvent<State, Event>>;
    public readonly beforeChange: Signal<FSMChangeEvent<State, Event>>;

    private graph: Map<State, Map<Event, State>>;
    private currentState: Map<Event, State>;
    private currentStateName: State;
    private readonly queue: Event[];

    constructor (graph: [State, [Event, State][]][], initialState: State) {
        super();
        
        this.change = new Signal<FSMChangeEvent<State, Event>>();
        this.beforeChange = new Signal<FSMChangeEvent<State, Event>>();

        this.queue = [];
        
        const [stateGraph, currentState, currentStateName] = FSM.buildGraph(graph, initialState);
        this.graph = stateGraph;
        this.currentState = currentState;
        this.currentStateName = currentStateName;

        this.validateGraph();
    }

    public override destructor (): void {
        this.change.destructor();
        this.beforeChange.destructor();

        super.destructor();
    }

    public get state (): State {
        return this.currentStateName;
    }

    public dispatch (event: Event): void {
        this.queue.push(event);
        if (this.queue.length > 1)
            return;

        for (const currentEvent of this.queue) {
            const nextState = this.currentState.get(currentEvent);
            if (!nextState)
                continue;
    
            const changeEvent = { from: this.currentStateName, to: nextState, event: currentEvent };
            try {
                this.beforeChange.emit(changeEvent);
            } catch (error) {
                console.error('Error in beforeChange event of the FSM:', error);
            }

            this.currentState = this.graph.get(nextState)!;
            this.currentStateName = nextState;

            try {
                this.change.emit(changeEvent);
            } catch (error) {
                console.error('Error in change event of the FSM:', error);
            }
        }

        this.queue.length = 0;
    }

    private validateGraph () {
        for (const [, transitions] of this.graph)
            for (const [, nextState] of transitions)
                if (!this.graph.has(nextState))
                    throw new Error(`Next state ${nextState} not found in graph`);
    }

    private static buildGraph<State extends string, Event extends string> (
        source: [State, [Event, State][]][],
        initialState: State): [Map<State, Map<Event, State>>, Map<Event, State>, State] 
    {
        const graph = new Map<State, Map<Event, State>>();
        let currentState: Map<Event, State> | undefined;
        let currentStateName: State | undefined;
        for (const [state, transitions] of source) {
            if (!state)
                throw new Error('Empty state names are not allowed');

            const stateGraph = new Map<Event, State>();
            for (const [event, nextState] of transitions) {
                if (!event)
                    throw new Error('Empty event names are not allowed');

                const size = stateGraph.size;
                stateGraph.set(event, nextState);
                if (stateGraph.size === size)
                    throw new Error(`Duplicate event: ${event} for state: ${state}`);
            }

            const size = graph.size;
            graph.set(state, stateGraph);
            if (graph.size === size)
                throw new Error(`Duplicate state: ${state}`);

            if (initialState === state) { 
                currentState = stateGraph;
                currentStateName = state;
            }
        }
        
        if (!currentState || !currentStateName)
            throw new Error(`Initial state ${initialState} not found in graph`);

        return [graph, currentState, currentStateName];
    }
}
