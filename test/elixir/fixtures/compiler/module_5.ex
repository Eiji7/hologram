# credo:disable-for-this-file Credo.Check.Readability.Specs
defmodule Hologram.Test.Fixtures.Compiler.Module5 do
  use Hologram.Page
  alias Hologram.Test.Fixtures.Compiler.Module7

  route "/hologram-test-fixtures-compiler-module5"

  layout Hologram.Test.Fixtures.Compiler.Module6

  def template do
    ~H"""
    Module5 template
    """
  end

  def action(:action_5a, params, client) do
    Module7.my_fun_7a(params, client)
  end

  def action(:action_5b, _params, client) do
    client
    |> Enum.to_list()
    |> :erlang.hd()
  end
end
