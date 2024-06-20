defmodule HologramFeatureTests.Helpers do
  alias Hologram.Router
  alias Wallaby.Browser

  defguard is_regex(term) when is_map(term) and term.__struct__ == Regex

  def assert_text(parent, text) when is_binary(text) do
    Wallaby.Browser.assert_text(parent, text)
  end

  def assert_text(parent, regex) when is_regex(regex) do
    if has_text?(parent, regex) do
      parent
    else
      raise Wallaby.ExpectationNotMetError, "Text '#{regex}' was not found."
    end
  end

  def assert_text(parent, query, text) when is_binary(text) do
    Wallaby.Browser.assert_text(parent, query, text)
  end

  def assert_text(parent, query, regex) when is_regex(regex) do
    parent
    |> Wallaby.Browser.find(query)
    |> assert_text(regex)
  end

  def has_text?(parent, text) when is_binary(text) do
    Wallaby.Browser.has_text?(parent, text)
  end

  def has_text?(parent, regex) when is_regex(regex) do
    result =
      Wallaby.Browser.retry(fn ->
        if Wallaby.Element.text(parent) =~ regex do
          {:ok, true}
        else
          {:error, false}
        end
      end)

    case result do
      {:ok, true} ->
        true

      {:error, false} ->
        false
    end
  end

  def visit(session, page_module) do
    visit(session, page_module, [])
  end

  def visit(session, page_module, params) do
    path = Router.Helpers.page_path(page_module, params)
    Browser.visit(session, path)
  end

  @doc """
  Returns the given argument.
  It prevents compiler warnings in tests when the given value is not permitted is specific situation.
  """
  @spec wrap_value(any) :: any
  def wrap_value(value) do
    value
  end
end
