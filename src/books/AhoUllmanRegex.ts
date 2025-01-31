export class AhoUllmanRegex {
    private minimizedDFA: DFA;
  
    constructor(pattern: string) {
      const postfix = infixToPostfix(pattern);
  
      const nfa = buildNFA(postfix);
  
      const dfa = nfaToDfa(nfa);
  
      this.minimizedDFA = minimizeDfa(dfa);
    }
  
    public test(str: string): boolean {
      let currentState = this.minimizedDFA.startState;
      for (const ch of str) {
        if (!this.minimizedDFA.transitions[currentState] ||
            !this.minimizedDFA.transitions[currentState][ch]) {
          return false; 
        }
        currentState = this.minimizedDFA.transitions[currentState][ch];
      }
      return this.minimizedDFA.acceptStates.has(currentState);
    }
  }
  
  type State = number;
  
  interface NFA {
    start: State;
    accept: State;
    transitions: Map<State, Map<string, State[]>>;
    epsilon: Map<State, State[]>;
  }
  
  interface DFA {
    startState: number;
    acceptStates: Set<number>;
    transitions: {
      [state: number]: {
        [symbol: string]: number;
      }
    };
  }
  
  function infixToPostfix(regex: string): string {
    const precedence: Record<string, number> = {
      '*': 3,
      '.': 2,
      '|': 1,
      '(': 0
    };
  
    const outputStack: string[] = [];
    const opStack: string[] = [];
  
    regex = insertExplicitConcatOperator(regex);
  
    for (let i = 0; i < regex.length; i++) {
      const token = regex[i];
      switch (token) {
        case '(':
          opStack.push(token);
          break;
  
        case ')':
          while (opStack.length && opStack[opStack.length - 1] !== '(') {
            outputStack.push(opStack.pop()!);
          }
          opStack.pop();
          break;
  
        case '|':
        case '*':
        case '.':
          while (
            opStack.length &&
            precedence[opStack[opStack.length - 1]] >= precedence[token]
          ) {
            outputStack.push(opStack.pop()!);
          }
          opStack.push(token);
          break;
  
        default:
          outputStack.push(token);
          break;
      }
    }
    while (opStack.length) {
      outputStack.push(opStack.pop()!);
    }
    return outputStack.join('');
  }

  function insertExplicitConcatOperator(regex: string): string {
    let output = '';
    for (let i = 0; i < regex.length; i++) {
      const c1 = regex[i];
      output += c1;
  
      if (i + 1 < regex.length) {
        const c2 = regex[i + 1];
  
        if (
          c1 !== '(' &&
          c1 !== '|' &&
          c1 !== '.' &&
          c2 !== '|' &&
          c2 !== ')' &&
          c2 !== '*'
        ) {
          output += '.';
        }
      }
    }
    return output;
  }
  
  let nfaStateCount = 0;
  
  function buildNFA(postfix: string): NFA {
    const stack: NFA[] = [];
    nfaStateCount = 0;
  
    for (const symbol of postfix) {
      if (symbol === '*') {
        const nfa = stack.pop()!;
        stack.push(applyKleeneStar(nfa));
      } else if (symbol === '.') {
        const nfa2 = stack.pop()!;
        const nfa1 = stack.pop()!;
        stack.push(concatNFAs(nfa1, nfa2));
      } else if (symbol === '|') {
        const nfa2 = stack.pop()!;
        const nfa1 = stack.pop()!;
        stack.push(unionNFAs(nfa1, nfa2));
      } else {
        stack.push(symbolToNFA(symbol));
      }
    }
  
    return stack.pop()!;
  }
  
  function createNFAState(): State {
    return nfaStateCount++;
  }
  
  function symbolToNFA(ch: string): NFA {
    const start = createNFAState();
    const accept = createNFAState();
    const transitions = new Map<State, Map<string, State[]>>();
    const epsilon = new Map<State, State[]>();
  
    transitions.set(start, new Map([[ch, [accept]]]));
    epsilon.set(start, []);
    epsilon.set(accept, []);
  
    return { start, accept, transitions, epsilon };
  }
  
  function unionNFAs(nfa1: NFA, nfa2: NFA): NFA {
    const start = createNFAState();
    const accept = createNFAState();
  
    const transitions = mergeTransitions(nfa1.transitions, nfa2.transitions);
    const epsilon = mergeEpsilon(nfa1.epsilon, nfa2.epsilon);
  
    epsilon.get(start)!.push(nfa1.start, nfa2.start);
    epsilon.get(nfa1.accept)!.push(accept);
    epsilon.get(nfa2.accept)!.push(accept);
  
    return { start, accept, transitions, epsilon };
  }
  
  function concatNFAs(nfa1: NFA, nfa2: NFA): NFA {
    const transitions = mergeTransitions(nfa1.transitions, nfa2.transitions);
    const epsilon = mergeEpsilon(nfa1.epsilon, nfa2.epsilon);
  
    epsilon.get(nfa1.accept)!.push(nfa2.start);
  
    return { start: nfa1.start, accept: nfa2.accept, transitions, epsilon };
  }
  
  function applyKleeneStar(nfa: NFA): NFA {
    const start = createNFAState();
    const accept = createNFAState();
  
    const transitions = copyTransitions(nfa.transitions);
    const epsilon = copyEpsilons(nfa.epsilon);
  
    epsilon.get(start)!.push(nfa.start, accept);
    epsilon.get(nfa.accept)!.push(accept, nfa.start);
  
    return { start, accept, transitions, epsilon };
  }
  
  function mergeTransitions(
    t1: Map<State, Map<string, State[]>>,
    t2: Map<State, Map<string, State[]>>
  ): Map<State, Map<string, State[]>> {
    const newT = copyTransitions(t1);
    for (const [state, mapSymbol] of t2) {
      if (!newT.has(state)) {
        newT.set(state, new Map());
      }
      const current = newT.get(state)!;
      for (const [symbol, destinations] of mapSymbol) {
        if (!current.has(symbol)) {
          current.set(symbol, []);
        }
        current.get(symbol)!.push(...destinations);
      }
    }
    return newT;
  }
  
  function mergeEpsilon(
    e1: Map<State, State[]>,
    e2: Map<State, State[]>
  ): Map<State, State[]> {
    const newE = copyEpsilons(e1);
    for (const [st, epsList] of e2) {
      if (!newE.has(st)) {
        newE.set(st, []);
      }
      newE.get(st)!.push(...epsList);
    }
    return newE;
  }
  
  function copyTransitions(
    source: Map<State, Map<string, State[]>>
  ): Map<State, Map<string, State[]>> {
    const result = new Map<State, Map<string, State[]>>();
    for (const [s, transMap] of source) {
      const newMap = new Map<string, State[]>();
      for (const [sym, arr] of transMap) {
        newMap.set(sym, [...arr]);
      }
      result.set(s, newMap);
    }
    for (const st of result.keys()) {
      if (!result.has(st)) {
        result.set(st, new Map());
      }
    }
    return result;
  }
  
  function copyEpsilons(source: Map<State, State[]>): Map<State, State[]> {
    const result = new Map<State, State[]>();
    for (const [s, arr] of source) {
      result.set(s, [...arr]);
    }
    for (const st of source.keys()) {
      if (!result.has(st)) {
        result.set(st, []);
      }
    }
    return result;
  }
  
  function nfaToDfa(nfa: NFA): DFA {
    const epsilonClosureCache = new Map<string, Set<State>>();
  
    function epsilonClosure(states: Set<State>): Set<State> {
      const key = [...states].sort().join(',');
      if (epsilonClosureCache.has(key)) {
        return epsilonClosureCache.get(key)!;
      }
      const closure = new Set<State>(states);
      const stack = [...states];
      while (stack.length) {
        const st = stack.pop()!;
        if (nfa.epsilon.has(st)) {
          for (const nxt of nfa.epsilon.get(st)!) {
            if (!closure.has(nxt)) {
              closure.add(nxt);
              stack.push(nxt);
            }
          }
        }
      }
      epsilonClosureCache.set(key, closure);
      return closure;
    }
  
    const startClosure = epsilonClosure(new Set<State>([nfa.start]));
    const dfaStartId = 0;
    const unmarked: Set<State>[] = [startClosure];
    const dfaStates: Set<State>[] = [startClosure];
    const transitions: { [state: number]: { [symbol: string]: number } } = {};
    const accepting: Set<number> = new Set();
  
    while (unmarked.length > 0) {
      const currentSet = unmarked.pop()!;
      const currentIndex = dfaStates.findIndex(
        (s) => setEquals(s, currentSet)
      );
      if (currentSet.has(nfa.accept)) {
        accepting.add(currentIndex);
      }
  
      transitions[currentIndex] = transitions[currentIndex] || {};
  
      const symbolNextStatesMap = new Map<string, Set<State>>();
  
      for (const st of currentSet) {
        if (nfa.transitions.has(st)) {
          for (const [sym, destStates] of nfa.transitions.get(st)!) {
            if (!symbolNextStatesMap.has(sym)) {
              symbolNextStatesMap.set(sym, new Set());
            }
            for (const dst of destStates) {
              symbolNextStatesMap.get(sym)!.add(dst);
            }
          }
        }
      }
  
      for (const [sym, stSet] of symbolNextStatesMap) {
        const ec = epsilonClosure(stSet);
        let foundIndex = dfaStates.findIndex((ds) => setEquals(ds, ec));
        if (foundIndex < 0) {
          dfaStates.push(ec);
          foundIndex = dfaStates.length - 1;
          unmarked.push(ec);
        }
        transitions[currentIndex][sym] = foundIndex;
      }
    }
  
    return {
      startState: dfaStartId,
      acceptStates: accepting,
      transitions
    };
  }
  
  function setEquals(a: Set<State>, b: Set<State>): boolean {
    if (a.size !== b.size) return false;
    for (const x of a) if (!b.has(x)) return false;
    return true;
  }
  
  function minimizeDfa(dfa: DFA): DFA {
    const states = Object.keys(dfa.transitions).map((s) => parseInt(s, 10));
    const acceptSet = dfa.acceptStates;
  
    let partitions: Set<number>[] = [
      new Set(states.filter((s) => !acceptSet.has(s))),
      new Set(states.filter((s) => acceptSet.has(s)))
    ].filter((part) => part.size > 0);
  
    let changed = true;
    while (changed) {
      changed = false;
  
      const newPartitions: Set<number>[] = [];
      for (const group of partitions) {
        if (group.size <= 1) {
          newPartitions.push(group);
          continue;
        }
  
        const refined = refinePartition(group, partitions, dfa.transitions);
        if (refined.length > 1) {
          changed = true;
        }
        newPartitions.push(...refined);
      }
      partitions = newPartitions;
    }
  
    const representative: { [oldState: number]: number } = {};
    partitions.forEach((part, index) => {
      for (const s of part) {
        representative[s] = index;
      }
    });
  
    const minTransitions: {
      [state: number]: { [symbol: string]: number };
    } = {};
    const minAccepting = new Set<number>();
  
    for (let i = 0; i < partitions.length; i++) {
      minTransitions[i] = {};
    }
  
    for (const oldSt of states) {
      const r = representative[oldSt];
      if (acceptSet.has(oldSt)) {
        minAccepting.add(r);
      }
      for (const symbol in dfa.transitions[oldSt]) {
        const oldDest = dfa.transitions[oldSt][symbol];
        const newDest = representative[oldDest];
        minTransitions[r][symbol] = newDest;
      }
    }

    const newStart = representative[dfa.startState];
  
    return {
      startState: newStart,
      acceptStates: minAccepting,
      transitions: minTransitions
    };
  }
  
  function refinePartition(
    group: Set<number>,
    partitions: Set<number>[],
    transitions: { [state: number]: { [symbol: string]: number } }
  ): Set<number>[] {
    if (group.size <= 1) return [group];
  
    const result: Set<number>[] = [];
  
    const signatureMap = new Map<string, Set<number>>();
  
    for (const state of group) {
      const signatureParts: string[] = [];
      const transObj = transitions[state] || {};
      const symbols = Object.keys(transObj);
      for (const sym of symbols.sort()) {
        const dest = transObj[sym];
        const partitionIndex = partitions.findIndex((p) => p.has(dest));
        signatureParts.push(`${sym}:${partitionIndex}`);
      }
  
      const signature = signatureParts.join('|');
      if (!signatureMap.has(signature)) {
        signatureMap.set(signature, new Set());
      }
      signatureMap.get(signature)!.add(state);
    }
  
    for (const subset of signatureMap.values()) {
      result.push(subset);
    }
  
    return result;
  }
  