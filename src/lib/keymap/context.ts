/**
 * Context predicates for the Zed-style keymap.
 *
 * Each keymap block may declare a `context` predicate; its bindings only apply when the predicate
 * holds against the set of currently-active context names (e.g. `{"Workspace","Grid"}`). Supported
 * grammar (a practical subset of Zed's): identifiers combined with `!`, `&&`, `||`, and parens —
 * e.g. `Editor && !Terminal`, `Grid || QA`. An empty/undefined predicate matches everywhere.
 */

type Node =
  | { t: "id"; name: string }
  | { t: "not"; e: Node }
  | { t: "and"; l: Node; r: Node }
  | { t: "or"; l: Node; r: Node };

type Token = { t: "id"; v: string } | { t: "op"; v: "!" | "&&" | "||" | "(" | ")" };

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === "(" || c === ")") {
      tokens.push({ t: "op", v: c });
      i++;
    } else if (c === "!") {
      tokens.push({ t: "op", v: "!" });
      i++;
    } else if (c === "&" && src[i + 1] === "&") {
      tokens.push({ t: "op", v: "&&" });
      i += 2;
    } else if (c === "|" && src[i + 1] === "|") {
      tokens.push({ t: "op", v: "||" });
      i += 2;
    } else if (/[A-Za-z0-9_]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      tokens.push({ t: "id", v: src.slice(i, j) });
      i = j;
    } else {
      // Unknown char — skip (lenient).
      i++;
    }
  }
  return tokens;
}

/** Recursive-descent parser: or → and → unary → primary. */
function parse(tokens: Token[]): Node | null {
  let pos = 0;
  const peek = () => tokens[pos];
  const eat = () => tokens[pos++];

  function parseOr(): Node | null {
    let left = parseAnd();
    while (left && peek()?.t === "op" && peek().v === "||") {
      eat();
      const right = parseAnd();
      if (!right) break;
      left = { t: "or", l: left, r: right };
    }
    return left;
  }
  function parseAnd(): Node | null {
    let left = parseUnary();
    while (left && peek()?.t === "op" && peek().v === "&&") {
      eat();
      const right = parseUnary();
      if (!right) break;
      left = { t: "and", l: left, r: right };
    }
    return left;
  }
  function parseUnary(): Node | null {
    if (peek()?.t === "op" && peek().v === "!") {
      eat();
      const e = parseUnary();
      return e ? { t: "not", e } : null;
    }
    return parsePrimary();
  }
  function parsePrimary(): Node | null {
    const tok = peek();
    if (!tok) return null;
    if (tok.t === "op" && tok.v === "(") {
      eat();
      const e = parseOr();
      if (peek()?.t === "op" && peek().v === ")") eat();
      return e;
    }
    if (tok.t === "id") {
      eat();
      return { t: "id", name: tok.v };
    }
    return null;
  }

  return parseOr();
}

function evalNode(node: Node, active: Set<string>): boolean {
  switch (node.t) {
    case "id":
      return active.has(node.name);
    case "not":
      return !evalNode(node.e, active);
    case "and":
      return evalNode(node.l, active) && evalNode(node.r, active);
    case "or":
      return evalNode(node.l, active) || evalNode(node.r, active);
  }
}

/** Compile a context predicate string into a fast `(activeContexts) => boolean` test. */
export function compileContext(expr: string | undefined): (active: Set<string>) => boolean {
  if (!expr || !expr.trim()) return () => true; // no context → matches everywhere
  const ast = parse(tokenize(expr));
  if (!ast) return () => true;
  return (active: Set<string>) => evalNode(ast, active);
}
