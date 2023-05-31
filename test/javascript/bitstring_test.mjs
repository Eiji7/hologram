"use strict";

import {assert} from "../../assets/js/test_support.mjs";
import Bitstring from "../../assets/js/bitstring.mjs";
import Type from "../../assets/js/type.mjs";

// IMPORTANT!
// Each JavaScript test has a related Elixir consistency test in test/elixir/hologram/ex_js_consistency/bitstring_test.exs
// Always update both together.
describe("from()", () => {
  describe("number and structure of segments", () => {
    it("builds empty bitstring without segments", () => {
      const result = Bitstring.from([]);

      const expected = {
        type: "bitstring",
        bits: new Uint8Array([]),
      };

      assert.deepStrictEqual(result, expected);
    });

    it("builds single-segment bitstring", () => {
      const segment = Type.bitstringSegment(Type.integer(1), {
        size: Type.integer(1),
        type: "integer",
        unit: 1n,
      });

      const result = Bitstring.from([segment]);

      const expected = {
        type: "bitstring",
        bits: new Uint8Array([1]),
      };

      assert.deepStrictEqual(result, expected);
    });

    it("builds multiple-segment bitstring", () => {
      const segment = Type.bitstringSegment(Type.integer(1), {
        size: Type.integer(1),
        type: "integer",
        unit: 1n,
      });

      const result = Bitstring.from([segment, segment]);

      const expected = {
        type: "bitstring",
        bits: new Uint8Array([1, 1]),
      };

      assert.deepStrictEqual(result, expected);
    });

    it("nested segments are flattened", () => {
      const segment1 = Type.bitstringSegment(Type.bitstring([1, 1]), {
        type: "bitstring",
      });

      const segment2 = Type.bitstringSegment(
        Type.bitstring([
          Type.bitstringSegment(Type.bitstring([1, 0]), {type: "bitstring"}),
          Type.bitstringSegment(Type.bitstring([1]), {type: "bitstring"}),
          Type.bitstringSegment(Type.bitstring([1, 0]), {type: "bitstring"}),
        ]),
        {type: "bitstring"}
      );

      const segment3 = Type.bitstringSegment(Type.bitstring([1, 1]), {
        type: "bitstring",
      });

      const result = Bitstring.from([segment1, segment2, segment3]);

      const expected = {
        type: "bitstring",
        bits: new Uint8Array([1, 1, 1, 0, 1, 1, 0, 1, 1]),
      };

      assert.deepStrictEqual(result, expected);
    });
  });

  describe("bitstring value", () => {
    it("defaults for bitstring value", () => {
      const segment = Type.bitstringSegment(Type.bitstring([1, 0, 1, 0]), {
        type: "bitstring",
      });

      const result = Bitstring.from([segment]);

      const expected = {
        type: "bitstring",
        bits: new Uint8Array([1, 0, 1, 0]),
      };

      assert.deepStrictEqual(result, expected);
    });

    it("with binary type modifier when segment number of bits is divisible by 8", () => {
      const segment = Type.bitstringSegment(
        Type.bitstring([1, 0, 1, 0, 1, 0, 1, 0]),
        {type: "binary"}
      );

      const result = Bitstring.from([segment]);

      const expected = {
        type: "bitstring",
        bits: new Uint8Array([1, 0, 1, 0, 1, 0, 1, 0]),
      };

      assert.deepStrictEqual(result, expected);
    });
  });

  describe("float value", () => {
    it("defaults for float value", () => {
      const segment = Type.bitstringSegment(Type.float(123.45), {
        type: "float",
      });

      const result = Bitstring.from([segment]);

      const expected = {
        type: "bitstring",
        // prettier-ignore
        bits: new Uint8Array([
                0, 1, 0, 0, 0, 0, 0, 0,
                0, 1, 0, 1, 1, 1, 1, 0,
                1, 1, 0, 1, 1, 1, 0, 0,
                1, 1, 0, 0, 1, 1, 0, 0,
                1, 1, 0, 0, 1, 1, 0, 0,
                1, 1, 0, 0, 1, 1, 0, 0,
                1, 1, 0, 0, 1, 1, 0, 0,
                1, 1, 0, 0, 1, 1, 0, 1
              ]),
      };

      assert.deepStrictEqual(result, expected);
    });
  });

  describe("integer value", () => {
    it("defaults for positive integer value that fits in 8 bits", () => {
      const segment = Type.bitstringSegment(Type.integer(170), {
        type: "integer",
      });

      const result = Bitstring.from([segment]);

      const expected = {
        type: "bitstring",
        bits: new Uint8Array([1, 0, 1, 0, 1, 0, 1, 0]),
      };

      assert.deepStrictEqual(result, expected);
    });

    it("defaults for negative integer value that fits in 8 bits", () => {
      const segment = Type.bitstringSegment(Type.integer(-22), {
        type: "integer",
      });

      const result = Bitstring.from([segment]);

      const expected = {
        type: "bitstring",
        bits: new Uint8Array([1, 1, 1, 0, 1, 0, 1, 0]),
      };

      assert.deepStrictEqual(result, expected);
    });

    it("defaults for positive integer value that fits in 12 bits", () => {
      const segment = Type.bitstringSegment(Type.integer(4010), {
        type: "integer",
      });

      const result = Bitstring.from([segment]);

      const expected = {
        type: "bitstring",
        bits: new Uint8Array([1, 0, 1, 0, 1, 0, 1, 0]),
      };

      assert.deepStrictEqual(result, expected);
    });

    it("defaults for negative integer value that fits in 12 bits", () => {
      const segment = Type.bitstringSegment(Type.integer(-86), {
        type: "integer",
      });

      const result = Bitstring.from([segment]);

      const expected = {
        type: "bitstring",
        bits: new Uint8Array([1, 0, 1, 0, 1, 0, 1, 0]),
      };

      assert.deepStrictEqual(result, expected);
    });
  });

  describe("string value", () => {
    it("defaults for string value", () => {
      const segment = Type.bitstringSegment(Type.string("全息图"), {
        type: "utf8",
      });

      const result = Bitstring.from([segment]);

      const expected = {
        type: "bitstring",
        // prettier-ignore
        bits: new Uint8Array([
            1, 1, 1, 0, 0, 1, 0, 1,
            1, 0, 0, 0, 0, 1, 0, 1,
            1, 0, 1, 0, 1, 0, 0, 0,
            1, 1, 1, 0, 0, 1, 1, 0,
            1, 0, 0, 0, 0, 0, 0, 1,
            1, 0, 1, 0, 1, 1, 1, 1,
            1, 1, 1, 0, 0, 1, 0, 1,
            1, 0, 0, 1, 1, 0, 1, 1,
            1, 0, 1, 1, 1, 1, 1, 0
          ]),
      };

      assert.deepStrictEqual(result, expected);
    });
  });

  describe("values of not supported data types", () => {
    it("atom values are not supported", () => {
      const segment = Type.bitstringSegment(Type.atom("abc"), {
        type: "integer",
      });

      assert.throw(
        () => {
          Bitstring.from([segment]);
        },
        Error,
        "(ArgumentError) construction of binary failed: segment 1 of type 'integer': expected an integer but got: :abc"
      );
    });

    it("list values are not supported", () => {
      const segment = Type.bitstringSegment(
        Type.list([Type.integer(1), Type.integer(2)]),
        {type: "integer"}
      );

      assert.throw(
        () => {
          Bitstring.from([segment]);
        },
        Error,
        "(ArgumentError) construction of binary failed: segment 1 of type 'integer': expected an integer but got: [1, 2]"
      );
    });

    it("tuple values are not supported", () => {
      const segment = Type.bitstringSegment(
        Type.tuple([Type.integer(1), Type.integer(2)]),
        {type: "integer"}
      );

      assert.throw(
        () => {
          Bitstring.from([segment]);
        },
        Error,
        "(ArgumentError) construction of binary failed: segment 1 of type 'integer': expected an integer but got: {1, 2}"
      );
    });
  });
});

// describe("bitstring()", () => {
//   describe("size & unit modifiers", () => {
//     it("fails to build bitstring from 32-bit float segment", () => {
//       const segment = Type.bitstringSegment(Type.float(123.45), {
//         size: Type.integer(8),
//         unit: 4n,
//       });

//       assert.throw(
//         () => {
//           Type.bitstring([segment]);
//         },
//         Error,
//         "(Hologram.NotYetImplementedError) 32-bit float bitstring segments are not yet implemented in Hologram"
//       );
//     });

//     it("fails to build bitstring from 16-bit float segment", () => {
//       const segment = Type.bitstringSegment(Type.float(123.45), {
//         size: Type.integer(8),
//         unit: 2n,
//       });

//       assert.throw(
//         () => {
//           Type.bitstring([segment]);
//         },
//         Error,
//         "(Hologram.NotYetImplementedError) 16-bit float bitstring segments are not yet implemented in Hologram"
//       );
//     });

//     it("on positive 12-bit integer", () => {
//       // 4010 (12 bits) -> 42 (6 bits)
//       // 4010 == 0b111110101010
//       // 42 == 0b101010

//       const segment = Type.bitstringSegment(Type.integer(4010), {
//         size: Type.integer(2),
//         unit: 3n,
//       });
//       const result = Type.bitstring([segment]);

//       const expected = {
//         type: "bitstring",
//         bits: new Uint8Array([1, 0, 1, 0, 1, 0]),
//       };

//       assert.deepStrictEqual(result, expected);
//     });

//     it("on negative 12-bit integer", () => {
//       // -86 (12 bits) -> 42 (6 bits)
//       // -86 == 0b111110101010
//       // 42 == 0b101010

//       const segment = Type.bitstringSegment(Type.integer(-86), {
//         size: Type.integer(2),
//         unit: 3n,
//       });
//       const result = Type.bitstring([segment]);

//       const expected = {
//         type: "bitstring",
//         bits: new Uint8Array([1, 0, 1, 0, 1, 0]),
//       };

//       assert.deepStrictEqual(result, expected);
//     });

//     it("size modifier on string segment with binary type modifier", () => {
//       // ?a == 97 == 0b01100001
//       // ?b == 98 == 0b01100010
//       // ?c == 99 == 0b01100011

//       const segment = Type.bitstringSegment(Type.string("abc"), {
//         type: "binary",
//         size: Type.integer(2),
//       });

//       const result = Type.bitstring([segment]);

//       const expected = {
//         type: "bitstring",
//         // prettier-ignore
//         bits: new Uint8Array([
//           0, 1, 1, 0, 0, 0, 0, 1,
//           0, 1, 1, 0, 0, 0, 1, 0
//         ]),
//       };

//       assert.deepStrictEqual(result, expected);
//     });

//     it("ignores unit modifier on string segment with binary type modifier if size modifier is not specified", () => {
//       // ?a == 97 == 0b01100001
//       // ?b == 98 == 0b01100010
//       // ?c == 99 == 0b01100011

//       const segment = Type.bitstringSegment(Type.string("abc"), {
//         type: "binary",
//         unit: Type.integer(2),
//       });

//       const result = Type.bitstring([segment]);

//       const expected = {
//         type: "bitstring",
//         // prettier-ignore
//         bits: new Uint8Array([
//           0, 1, 1, 0, 0, 0, 0, 1,
//           0, 1, 1, 0, 0, 0, 1, 0,
//           0, 1, 1, 0, 0, 0, 1, 1
//         ]),
//       };

//       assert.deepStrictEqual(result, expected);
//     });

//     it("size modifier with unit modifier on string segment with binary type modifier", () => {
//       // ?a == 97 == 0b01100001
//       // ?b == 98 == 0b01100010
//       // ?c == 99 == 0b01100011

//       const segment = Type.bitstringSegment(Type.string("abc"), {
//         type: "binary",
//         size: Type.integer(4),
//         unit: 3n,
//       });

//       const result = Type.bitstring([segment]);

//       const expected = {
//         type: "bitstring",
//         // prettier-ignore
//         bits: new Uint8Array([
//           0, 1, 1, 0, 0, 0, 0, 1,
//           0, 1, 1, 0
//         ]),
//       };

//       assert.deepStrictEqual(result, expected);
//     });

//     it("requires size modifier if unit modifier is specified on float segment", () => {
//       const segment = Type.bitstringSegment(Type.float(123.45), {
//         unit: Type.integer(1),
//       });

//       assert.throw(
//         () => {
//           Type.bitstring([segment]);
//         },
//         Error,
//         "(CompileError) integer and float types require a size specifier if the unit specifier is given"
//       );
//     });

//     it("size modifier on string segment with utf8 type modifier", () => {
//       const segment = Type.bitstringSegment(Type.string("abcdefghi"), {
//         type: "utf8",
//         size: Type.integer(8),
//       });

//       assert.throw(
//         () => {
//           Type.bitstring([segment]);
//         },
//         Error,
//         "(CompileError) size and unit are not supported on utf types"
//       );
//     });

//     it("size modifier on string segment with utf16 type modifier", () => {
//       const segment = Type.bitstringSegment(Type.string("abcdefghi"), {
//         type: "utf16",
//         size: Type.integer(8),
//       });

//       assert.throw(
//         () => {
//           Type.bitstring([segment]);
//         },
//         Error,
//         "(CompileError) size and unit are not supported on utf types"
//       );
//     });

//     it("size modifier on string segment with utf32 type modifier", () => {
//       const segment = Type.bitstringSegment(Type.string("abcdefghi"), {
//         type: "utf32",
//         size: Type.integer(8),
//       });

//       assert.throw(
//         () => {
//           Type.bitstring([segment]);
//         },
//         Error,
//         "(CompileError) size and unit are not supported on utf types"
//       );
//     });

//     it("unit modifier on string segment with utf8 type modifier", () => {
//       const segment = Type.bitstringSegment(Type.string("abcdefghi"), {
//         type: "utf8",
//         unit: Type.integer(1),
//       });

//       assert.throw(
//         () => {
//           Type.bitstring([segment]);
//         },
//         Error,
//         "(CompileError) size and unit are not supported on utf types"
//       );
//     });

//     it("unit modifier on string segment with utf16 type modifier", () => {
//       const segment = Type.bitstringSegment(Type.string("abcdefghi"), {
//         type: "utf16",
//         unit: Type.integer(1),
//       });

//       assert.throw(
//         () => {
//           Type.bitstring([segment]);
//         },
//         Error,
//         "(CompileError) size and unit are not supported on utf types"
//       );
//     });

//     it("unit modifier on string segment with utf32 type modifier", () => {
//       const segment = Type.bitstringSegment(Type.string("abcdefghi"), {
//         type: "utf32",
//         unit: Type.integer(1),
//       });

//       assert.throw(
//         () => {
//           Type.bitstring([segment]);
//         },
//         Error,
//         "(CompileError) size and unit are not supported on utf types"
//       );
//     });
//   });

//   describe("type modifier", () => {
//     it("raises ArgumentError if there is a mismatch between segment declared type and runtime type", () => {
//       const segment = Type.bitstringSegment(Type.float(123.45), {
//         type: "integer",
//       });

//       assert.throw(
//         () => {
//           Type.bitstring([segment]);
//         },
//         Error,
//         "(ArgumentError) construction of binary failed: segment 1 of type 'integer': expected an integer but got: 123.45"
//       );
//     });
//   });
// });

// describe("bitstringSegment()", () => {
//   it("fails to build float segment which is not 16-bit, 32-bit or 64-bit", () => {
//     const segment = Type.bitstringSegment(Type.float(123.45), {
//       size: Type.integer(11),
//     });

//     assert.throw(
//       () => {
//         Type.bitstring([segment]);
//       },
//       Error,
//       "(ArgumentError) construction of binary failed: segment 1 of type 'float': expected one of the supported sizes 16, 32, or 64 but got: 11"
//     );
//   });
// });
