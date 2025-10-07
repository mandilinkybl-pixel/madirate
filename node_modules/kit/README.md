[![npm version](https://img.shields.io/npm/v/kit.svg?color=blue)](https://www.npmjs.com/package/kit) [![npm downloads](https://img.shields.io/npm/dm/kit.svg?color=brightgreen)](https://www.npmjs.com/package/kit) [![GitHub stars](https://img.shields.io/github/stars/teniryte/kit?style=social)](https://github.com/teniryte/kit) [![License](https://img.shields.io/github/license/teniryte/kit)](LICENSE)

# kit

A lightweight TypeScript library providing some specific utilities and types.

## Installation

```bash
npm install kit
# or
yarn add kit
# or
bun add kit
```

## Usage

```typescript
import { flatten } from 'kit';
// or
import flatten from 'kit/flatten';

```

## Utilities

### callAll

> Utility that calls all provided functions with the same arguments, useful for combining multiple event handlers or callbacks.

```ts
import { callAll } from 'kit';

// Combine multiple event handlers
const handleClick = (event: MouseEvent) => console.log('Click!');
const handleAnalytics = (event: MouseEvent) => analytics.track('click', event);
const handleLogging = (event: MouseEvent) => logger.log('User clicked', event);

// Call all handlers with one call
const combinedHandler = callAll(handleClick, handleAnalytics, handleLogging);
button.addEventListener('click', combinedHandler);

// Or call them directly
callAll(handleClick, handleAnalytics, handleLogging)(event);

// Works with any number of functions
const singleHandler = callAll(handleClick); // Returns handleClick as-is
const noHandlers = callAll(); // Returns a no-op function
```

### kindOf

> Returns the specific type/kind of a value with enhanced type detection beyond `typeof`.

```ts
import { kindOf, Kind } from 'kit';

kindOf(null); // => Kind.Null
kindOf(undefined); // => Kind.Undefined
kindOf(NaN); // => Kind.Nan

kindOf('string'); // => Kind.String
kindOf(123); // => Kind.Number
kindOf(true); // => Kind.Boolean
kindOf(Symbol()); // => Kind.Symbol
kindOf([]); // => Kind.Array
kindOf(arguments); // => Kind.ArrayLike

kindOf(() => {}); // => Kind.Function

kindOf(new Set()); // => Kind.Set
kindOf(new Map()); // => Kind.Map
kindOf(new Date()); // => Kind.Date
kindOf(/regex/); // => Kind.RegExp
kindOf(Buffer.from('test')); // => Kind.Buffer

kindOf(class Test {}); // => Kind.Class
kindOf(Set); // => Kind.Class
kindOf(Map); // => Kind.Class
kindOf(Date); // => Kind.Class
```

### pluralize

> Russian pluralization utility that returns the correct word form based on count.

```ts
import { pluralize } from 'kit';

// Basic usage with three forms: nominative, genitive singular, genitive plural
pluralize(0, 'ящик', 'ящика', 'ящиков'); // => 'ящиков'
pluralize(1, 'ящик', 'ящика', 'ящиков'); // => 'ящик'
pluralize(2, 'ящик', 'ящика', 'ящиков'); // => 'ящика'
pluralize(5, 'ящик', 'ящика', 'ящиков'); // => 'ящиков'

// Can also use arrays
pluralize(1, ['ящик', 'ящика', 'ящиков']); // => 'ящик'
pluralize(2, ['ящик', 'ящика', 'ящиков']); // => 'ящика'
```

### flatten

> Flattens an object or an array.

```ts
import { flatten } from 'kit';

// Flatten an array
const flatNumbers = flatten([1, [2, [3, 4]]]); // => [1, 2, 3, 4]

// Flatten an object
const flatObject = flatten({
  a: 1,
  b: {
    c: {
      d: 2
    },
    d: [3, 4]
  }
}); // => { a: 1, 'b.c.d': 2, 'b.d': [3, 4]}

// Flatten an object with arrays unpacking
const flatObject = flatten({
  a: 1,
  b: {
    c: {
      d: 2
    },
    d: [3, 4]
  }
}); // => { a: 1, 'b.c.d': 2, 'b.d.0': 3, 'b.d.1': 4}
```

### debugString

> Converts any value into a readable string representation for debugging purposes. Guarantees to return a string representation of any value, first attempting to serialize it using JSON, and in case of failure, obtaining the most human-readable string description. 

```ts
import { debugString } from 'kit';

// Primitives
debugString(123); // => '123'
debugString('hello'); // => 'hello'
debugString(null); // => 'null'
debugString(undefined); // => 'undefined'
debugString(true); // => 'true'
debugString(NaN); // => 'NaN'

// Functions
debugString(() => {}); // => '[function ()]'
debugString((a: number) => a); // => '[function (a)]'
debugString(function test(a: number) {}); // => '[function test(a)]'

// Arrays
debugString([1, 2, 3]); // => '[1, 2, 3]'

// Objects
debugString({ a: 1, b: 2, doc: document }); /** => {
  "a": 1,
  "b": 2,
  "doc": [object HTMLDocument]
} */

// Classes
debugString(class Person {}); // => '[class Person]'
debugString(Date); // => '[class Date]'

// Symbols
debugString(Symbol('test')); // => 'Symbol(test)'

// HTMl Elements
debugString(document.body); // => '<body class="dark-theme"><h1>...</body>'
```

### argsNames

> Extracts parameter names from a function as an array of strings.

```ts
import { argsNames } from 'kit';

// Extract parameter names from arrow functions
argsNames(() => {}); // => []
argsNames((a: number) => a); // => ['a']

// Extract parameter names from regular functions
argsNames(function (a: number, b: number) {
  return a + b;
}); // => ['a', 'b']

```

### EventEmitter

> A simple event emitter implementation for handling custom events.

```ts
import { EventEmitter } from 'kit';

const emitter = new EventEmitter();

// Subscribe to events
emitter.on('user:login', (user: User) => {
  console.log('User logged in:', user);
});

// Emit events
emitter.emit('user:login', { id: 1, name: 'John' });

// Emit once
emitter.once('user:login', { id: 1, name: 'John' });

// Remove listener
emitter.off('user:login', handler);

// Remove all listeners of event
emitter.removeAllListeners('user:login');
// or to empty event emitter
emitter.removeAllListeners();
```

### isClass

> Checks if a value is a class constructor function.

```ts
import { isClass } from 'kit';

// Class constructors
isClass(class Person {}); // => true
isClass(Date); // => true
isClass(Set); // => true
isClass(Map); // => true

// Regular functions
isClass(() => {}); // => false
isClass(function() {}); // => false
isClass(function parse() {}); // => false
isClass(function Person() {}); // => true

// Other values
isClass('string'); // => false
isClass(123); // => false
isClass({}); // => false
isClass([]); // => false
```

## Types & Enums

### Kind

> Enum containing possible kind of value variants:

```ts
enum Kind {
  Null = 'null',
  String = 'string',
  Undefined = 'undefined',
  Array = 'array',
  ArrayLike = 'arraylike',
  Class = 'class',
  Function = 'function',
  Symbol = 'symbol',
  Number = 'number',
  Date = 'date',
  Boolean = 'boolean',
  RegExp = 'regexp',
  Buffer = 'buffer',
  NaN = 'nan',
  Set = 'set',
  Map = 'map',
  ArrayBuffer = 'arraybuffer',
  Error = 'error',
  Promise = 'promise',
  WeakMap = 'weakmap',
  WeakSet = 'weakset',
  Int8Array = 'int8array',
  Uint8Array = 'uint8array',
  Uint8ClampedArray = 'uint8clampedarray',
}
```

### Primitive

> Simple type for primitives.

```ts
import { Primitive } from 'kit';

type MyObject = {
  var1: Primitive;
};
```

## License

MIT