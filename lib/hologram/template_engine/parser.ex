defmodule Hologram.TemplateEngine.Parser do
  use Hologram.Parser

  def parse(str) do
    result =
      ("<root>" <> fix_quotes(str) <> "</root>")
      |> Saxy.SimpleForm.parse_string()

    case result do
      {:ok, {"root", [], nodes}} ->
        {:ok, nodes}

      _ ->
        result
    end
  end

  defp fix_quotes(str) do
    regex = ~r/=(\{\{.+\}\})/U
    Regex.replace(regex, str, "=\"\\1\"")
  end
end
