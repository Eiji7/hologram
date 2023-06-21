"use strict";

import Interpreter from "../interpreter.mjs";
import Type from "../type.mjs";

const Erlang = {
  // supported arities: 2
  // start: +
  $243: function (left, right) {
    const [type, leftValue, rightValue] =
      Erlang._ensureBothAreIntegersOrBothAreFloats(left, right);

    const result = leftValue.value + rightValue.value;

    return type === "float" ? Type.float(result) : Type.integer(result);
  },
  // end: +

  // supported arities: 2
  // start: -
  $245: function (left, right) {
    const [type, leftValue, rightValue] =
      Erlang._ensureBothAreIntegersOrBothAreFloats(left, right);

    const result = leftValue.value - rightValue.value;

    return type === "float" ? Type.float(result) : Type.integer(result);
  },
  // end: -

  // supported arities: 2
  // start: /=
  $247$261: function (left, right) {
    const isEqual = Erlang.$261$261(left, right);
    return Type.boolean(Type.isFalse(isEqual));
  },
  // end: /=

  // TODO: Implement structural comparison, see: https://hexdocs.pm/elixir/main/Kernel.html#module-structural-comparison
  // supported arities: 2
  // start: <
  $260: function (left, right) {
    if (
      (!Type.isFloat(left) && !Type.isInteger(left)) ||
      (!Type.isFloat(right) && !Type.isInteger(right))
    ) {
      const message =
        ":erlang.</2 currently supports only floats and integers" +
        ", left = " +
        Interpreter.inspect(left) +
        ", right = " +
        Interpreter.inspect(right);

      Hologram.raiseInterpreterError(message);
    }

    return Type.boolean(left.value < right.value);
  },
  // end: <

  // supported arities: 2
  // start: =:=
  $261$258$261: function (left, right) {
    return Type.boolean(Interpreter.isStrictlyEqual(left, right));
  },
  // end: =:=

  // supported arities: 2
  // start: ==
  $261$261: function (left, right) {
    let value;

    switch (left.type) {
      case "float":
      case "integer":
        if (Type.isNumber(left) && Type.isNumber(right)) {
          value = left.value == right.value;
        } else {
          value = false;
        }
        break;

      default:
        value = left.type === right.type && left.value === right.value;
        break;
    }

    return Type.boolean(value);
  },
  // end: ==

  // TODO: Implement structural comparison, see: https://hexdocs.pm/elixir/main/Kernel.html#module-structural-comparison
  // supported arities: 2
  // start: >
  $262: function (left, right) {
    if (
      (!Type.isFloat(left) && !Type.isInteger(left)) ||
      (!Type.isFloat(right) && !Type.isInteger(right))
    ) {
      const message =
        ":erlang.>/2 currently supports only floats and integers" +
        ", left = " +
        Interpreter.inspect(left) +
        ", right = " +
        Interpreter.inspect(right);

      Hologram.raiseInterpreterError(message);
    }

    return Type.boolean(left.value > right.value);
  },
  // end: >

  // TODO: error/2
  // supported arities: 1
  // start: error
  error: function (reason) {
    throw new Error(`__hologram__:${Hologram.serialize(reason)}`);
  },
  // end: error

  // supported arities: 1
  // start: hd
  hd: function (list) {
    return Interpreter.head(list);
  },
  // end: hd

  // supported arities: 1
  // start: is_atom
  is_atom: function (term) {
    return Type.boolean(Type.isAtom(term));
  },
  // end: is_atom

  // supported arities: 1
  // start: is_float
  is_float: function (term) {
    return Type.boolean(Type.isFloat(term));
  },
  // end: is_float

  // supported arities: 1
  // start: is_integer
  is_integer: function (term) {
    return Type.boolean(Type.isInteger(term));
  },
  // end: is_integer

  // supported arities: 1
  // start: is_number
  is_number: function (term) {
    return Type.boolean(Type.isNumber(term));
  },
  // end: is_number

  // supported arities: 1
  // start: length
  length: function (list) {
    return Type.integer(Interpreter.count(list));
  },
  // end: length

  // supported arities: 1
  // start: tl
  tl: function (list) {
    return Interpreter.tail(list);
  },
  // end: tl

  _ensureBothAreIntegersOrBothAreFloats: function (boxed1, boxed2) {
    const type =
      Type.isFloat(boxed1) || Type.isFloat(boxed2) ? "float" : "integer";

    let value1, value2;

    if (type === "float" && Type.isInteger(boxed1)) {
      value1 = Type.float(Number(boxed1.value));
    } else {
      value1 = boxed1;
    }

    if (type === "float" && Type.isInteger(boxed2)) {
      value2 = Type.float(Number(boxed2.value));
    } else {
      value2 = boxed2;
    }

    return [type, value1, value2];
  },
};

export default Erlang;
