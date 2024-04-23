defmodule Hologram.Benchmarks do
  alias Hologram.Commons.CryptographicUtils
  alias Hologram.Commons.PLT
  alias Hologram.Compiler

  @doc """
  Generates 2 module digest PLTs that fullfill the conditions given in the arguments.
  The fourth argument is implicit: untouched_modules_perc = 100 - added_modules_perc - removed_modules_perc - updated_modules_perc.
  """
  @spec generate_module_digest_plts(integer, integer, integer) :: {PLT.t(), PLT.t()}
  def generate_module_digest_plts(added_modules_perc, removed_modules_perc, updated_modules_perc) do
    if added_modules_perc + removed_modules_perc + updated_modules_perc > 100 do
      raise ArgumentError, message: "the sum of the arguments must be less than or equal to 100"
    end

    module_digests =
      Compiler.build_module_beam_path_plt()
      |> Compiler.build_module_digest_plt!()
      |> PLT.get_all()
      |> Map.to_list()

    num_modules = Enum.count(module_digests)

    num_added_modules = Integer.floor_div(added_modules_perc * num_modules, 100)
    num_removed_modules = Integer.floor_div(removed_modules_perc * num_modules, 100)
    num_updated_modules = Integer.floor_div(updated_modules_perc * num_modules, 100)

    num_untouched_modules =
      num_modules - num_added_modules - num_removed_modules - num_updated_modules

    added_modules_chunk = Enum.take(module_digests, num_added_modules)

    removed_modules_chunk =
      module_digests
      |> Enum.drop(num_added_modules)
      |> Enum.drop(-num_untouched_modules)
      |> Enum.drop(-num_updated_modules)

    old_updated_modules_chunk =
      module_digests
      |> Enum.drop(num_added_modules)
      |> Enum.drop(num_removed_modules)
      |> Enum.drop(-num_untouched_modules)

    untouched_modules_chunk = Enum.take(module_digests, -num_untouched_modules)

    old_module_digest_plt =
      PLT.start(
        items: removed_modules_chunk ++ old_updated_modules_chunk ++ untouched_modules_chunk
      )

    new_updated_modules_chunk =
      Enum.map(old_updated_modules_chunk, fn {module, digest} ->
        {module, CryptographicUtils.digest(digest, :sha256, :binary)}
      end)

    new_module_digest_plt =
      PLT.start(
        items: added_modules_chunk ++ new_updated_modules_chunk ++ untouched_modules_chunk
      )

    {old_module_digest_plt, new_module_digest_plt}
  end
end
