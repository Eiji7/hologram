"use strict";

import {assert} from "../../assets/js/test_support.mjs";
import Interpreter from "../../assets/js/interpreter.mjs";
import Type from "../../assets/js/type.mjs";

describe("consOperator()", () => {
  it("prepends left boxed item to the right boxed list", () => {
    const left = Type.integer(1);
    const right = Type.list([Type.integer(2), Type.integer(3)]);
    const result = Interpreter.consOperator(left, right);

    const expected = Type.list([
      Type.integer(1),
      Type.integer(2),
      Type.integer(3),
    ]);

    assert.deepStrictEqual(result, expected);
  });
});

describe("count()", () => {
  it("returns the number of items in a boxed list", () => {
    const list = Type.list([Type.integer(1), Type.integer(2)]);
    const result = Interpreter.count(list);

    assert.equal(result, 2);
  });

  it("returns the number of items in a boxed map", () => {
    const map = Type.map([
      [Type.atom("a"), Type.integer(1)],
      [Type.atom("b"), Type.integer(2)],
    ]);

    const result = Interpreter.count(map);

    assert.equal(result, 2);
  });

  it("returns the number of items in a boxed tuple", () => {
    const tuple = Type.tuple([Type.integer(1), Type.integer(2)]);
    const result = Interpreter.count(tuple);

    assert.equal(result, 2);
  });
});

describe("head()", () => {
  it("returns the first item in a boxed list", () => {
    const list = Type.list([Type.integer(1), Type.integer(2), Type.integer(3)]);
    const result = Interpreter.head(list);

    assert.deepStrictEqual(result, Type.integer(1));
  });
});

describe("isStrictlyEqual()", () => {
  it("returns true if the args are of the same boxed primitive type and have equal values", () => {
    const result = Interpreter.isStrictlyEqual(
      Type.integer(1),
      Type.integer(1)
    );

    assert.isTrue(result);
  });

  it("returns false if the args are not of the same boxed primitive type but have equal values", () => {
    const result = Interpreter.isStrictlyEqual(
      Type.integer(1),
      Type.float(1.0)
    );

    assert.isFalse(result);
  });

  it("returns true if the left boxed arg of a composite type is deeply equal to the right boxed arg of a composite type", () => {
    const left = Type.map([
      [Type.atom("a"), Type.integer(1)],
      [Type.atom("b"), Type.map([[Type.atom("c"), Type.integer(3)]])],
    ]);

    const right = Type.map([
      [Type.atom("a"), Type.integer(1)],
      [Type.atom("b"), Type.map([[Type.atom("c"), Type.integer(3)]])],
    ]);

    const result = Interpreter.isStrictlyEqual(left, right);

    assert.isTrue(result);
  });

  it("returns false if the left boxed arg of a composite type is not deeply equal to the right boxed arg of a composite type", () => {
    const left = Type.map([
      [Type.atom("a"), Type.integer(1)],
      [Type.atom("b"), Type.map([[Type.atom("c"), Type.integer(3)]])],
    ]);

    const right = Type.map([
      [Type.atom("a"), Type.integer(1)],
      [Type.atom("b"), Type.map([[Type.atom("c"), Type.integer(4)]])],
    ]);

    const result = Interpreter.isStrictlyEqual(left, right);

    assert.isFalse(result);
  });
});

describe("inspect()", () => {
  it("inspects boxed atom", () => {
    const result = Interpreter.inspect(Type.atom("abc"));
    assert.equal(result, ":abc");
  });

  it("inspects boxed float", () => {
    const result = Interpreter.inspect(Type.float(123.45));
    assert.equal(result, "123.45");
  });

  it("inspects boxed integer", () => {
    const result = Interpreter.inspect(Type.integer(123));
    assert.equal(result, "123");
  });

  it("inspects boxed list", () => {
    const term = Type.list([Type.integer(123), Type.string("abc")]);
    const result = Interpreter.inspect(term);

    assert.equal(result, '[123, "abc"]');
  });

  it("inspects boxed string", () => {
    const result = Interpreter.inspect(Type.string("abc"));
    assert.equal(result, '"abc"');
  });

  it("inspects boxed tuple", () => {
    const term = Type.tuple([Type.integer(123), Type.string("abc")]);
    const result = Interpreter.inspect(term);

    assert.equal(result, '{123, "abc"}');
  });

  it("inspects other boxed types", () => {
    const segment = Type.bitstringSegment(Type.integer(170), {});
    const term = Type.bitstring([segment]);
    const result = Interpreter.inspect(term);

    assert.equal(
      result,
      '{"type":"bitstring","bits":{"0":1,"1":0,"2":1,"3":0,"4":1,"5":0,"6":1,"7":0}}'
    );
  });

  // TODO: test other boxed types
});

describe("raiseError()", () => {
  it("throws an error with the given message", () => {
    assert.throw(
      () => {
        Interpreter.raiseError("MyType", "my message");
      },
      Error,
      "(MyType) my message"
    );
  });
});

describe("raiseNotYetImplementedError()", () => {
  it("throws a Hologram.NotYetImplemented error with the given message", () => {
    assert.throw(
      () => {
        Interpreter.raiseNotYetImplementedError("my message");
      },
      Error,
      "(Hologram.NotYetImplementedError) my message"
    );
  });
});

describe("tail()", () => {
  it("returns the tail of a boxed list", () => {
    const list = Type.list([Type.integer(1), Type.integer(2), Type.integer(3)]);
    const result = Interpreter.tail(list);
    const expected = Type.list([Type.integer(2), Type.integer(3)]);

    assert.deepStrictEqual(result, expected);
  });
});
