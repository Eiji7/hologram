defmodule Hologram.Compiler.IR do
  alias Hologram.Compiler.AST
  alias Hologram.Compiler.IR
  alias Hologram.Compiler.Transformer

  @type t ::
          IR.AnonymousFunctionCall.t()
          | IR.AtomType.t()
          | IR.ConsOperator.t()
          | IR.DotOperator.t()
          | IR.FloatType.t()
          | IR.IntegerType.t()
          | IR.ListType.t()
          | IR.LocalFunctionCall.t()
          | IR.MapType.t()
          | IR.MatchOperator.t()
          | IR.ModuleAttributeOperator.t()
          | IR.PinOperator.t()
          | IR.RemoteFunctionCall.t()
          | IR.TupleType.t()
          | IR.Variable.t()

  defmodule AnonymousFunctionCall do
    defstruct [:function, :args]

    @type t :: %__MODULE__{function: IR.t(), args: list(IR.t())}
  end

  defmodule AtomType do
    defstruct [:value]

    @type t :: %__MODULE__{value: atom}
  end

  defmodule ConsOperator do
    defstruct [:head, :tail]

    @type t :: %__MODULE__{head: IR.t(), tail: IR.t()}
  end

  defmodule DotOperator do
    defstruct [:left, :right]

    @type t :: %__MODULE__{left: IR.t(), right: IR.t()}
  end

  defmodule FloatType do
    defstruct [:value]

    @type t :: %__MODULE__{value: float}
  end

  defmodule IntegerType do
    defstruct [:value]

    @type t :: %__MODULE__{value: integer}
  end

  defmodule ListType do
    defstruct [:data]

    @type t :: %__MODULE__{data: list(IR.t())}
  end

  defmodule LocalFunctionCall do
    defstruct [:function, :args]

    @type t :: %__MODULE__{function: atom, args: list(IR.t())}
  end

  defmodule MapType do
    defstruct [:data]

    @type t :: %__MODULE__{data: list({IR.t(), IR.t()})}
  end

  defmodule MatchOperator do
    defstruct [:left, :right]

    @type t :: %__MODULE__{left: IR.t(), right: IR.t()}
  end

  defmodule ModuleAttributeOperator do
    defstruct [:name]

    @type t :: %__MODULE__{name: atom}
  end

  defmodule PinOperator do
    defstruct [:name]

    @type t :: %__MODULE__{name: atom}
  end

  defmodule RemoteFunctionCall do
    defstruct [:module, :function, :args]

    @type t :: %__MODULE__{module: IR.t(), function: IR.t(), args: list(IR.t())}
  end

  defmodule TupleType do
    defstruct [:data]

    @type t :: %__MODULE__{data: list(IR.t())}
  end

  defmodule Variable do
    defstruct [:name]

    @type t :: %__MODULE__{name: atom}
  end

  @doc """
  Given Elixir source code returns its Hologram IR.

  ## Examples

      iex> for_code("my_fun(1, 2)")
      %IR.LocalFunctionCall{function: :my_fun, args: [%IR.IntegerType{value: 1}, %IR.IntegerType{value: 2}]}
  """
  @spec for_code(binary) :: IR.t()
  def for_code(code) do
    code
    |> AST.for_code()
    |> Transformer.transform()
  end
end
