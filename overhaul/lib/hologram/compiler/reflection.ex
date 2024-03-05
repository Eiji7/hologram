defmodule Hologram.Compiler.Reflection do
  alias Hologram.Compiler.{Context, Helpers, Normalizer, Parser, Transformer}
  alias Hologram.Compiler.IR.ModuleDefinition
  alias Hologram.Utils

  @config Application.get_all_env(:hologram)

  @ignored_modules [Ecto.Changeset, Hologram.Router, Hologram.Runtime.JS] ++
                     Application.compile_env(:hologram, :ignored_modules, [])

  @ignored_namespaces Application.compile_env(:hologram, :ignored_namespaces, [])

  def app_path(opts \\ []) do
    path_from_opts = Keyword.get(opts, :app_path)
    path_from_config = Application.get_env(:hologram, :app_path)

    case {path_from_opts, path_from_config} do
      {nil, nil} -> root_path(opts) <> "/lib"
      {nil, path_from_config} -> path_from_config
      {path_from_opts, _} -> path_from_opts
    end
  end

  # DEFER: test
  def assets_path(opts \\ @config) do
    root_path(opts) <> "/deps/hologram/assets"
  end

  def ast(module) when is_atom(module) do
    source_path(module)
    |> Parser.parse_file!()
    |> Normalizer.normalize()
  end

  def ast(code) when is_binary(code) do
    Parser.parse!(code)
    |> Normalizer.normalize()
  end

  def ast(alias_segs) when is_list(alias_segs) do
    Helpers.module(alias_segs)
    |> ast()
  end

  def functions(module) do
    module.__info__(:functions)
  end

  # DEFER: test
  def has_release_page_list? do
    release_page_list_path()
    |> File.exists?()
  end

  # Kernel.macro_exported?/3 does not load the module in case it is not loaded
  # (in such cases it would return false even when the module has the given macro).
  def has_macro?(module, function, arity) do
    if is_module?(module) do
      has_function?(module, :"MACRO-#{function}", arity + 1)
    else
      false
    end
  end

  def has_template?(module) do
    has_function?(module, :template, 0)
  end

  def hologram_ui_components_path do
    source_path(Hologram.UI.Runtime)
    |> String.replace_suffix("/runtime.ex", "")
  end

  def is_ignored_module?(module) do
    if module in @ignored_modules do
      true
    else
      module_name = to_string(module)

      Enum.any?(@ignored_namespaces, fn namespace ->
        String.starts_with?(module_name, to_string(namespace) <> ".")
      end)
    end
  end

  def is_protocol?(term) do
    if alias?(term) do
      case Code.ensure_loaded(term) do
        {:module, _} ->
          Keyword.has_key?(term.module_info(:exports), :__protocol__)

        _ ->
          false
      end
    else
      false
    end
  end

  # DEFER: test
  def lib_path(opts \\ []) do
    root_path(opts) <> "/lib"
  end

  # DEFER: test
  def list_release_pages do
    page_list_path = release_page_list_path()

    if File.exists?(page_list_path) do
      page_list_path
      |> File.read!()
      |> Utils.deserialize()
    else
      []
    end
  end

  def list_components(opts \\ []) do
    app_components_path = app_path(opts)
    app_components = list_modules_of_type(:component, app_components_path)

    hologram_ui_components_path = hologram_ui_components_path()

    hologram_ui_components =
      list_modules_of_type(:component, hologram_ui_components_path, :hologram)

    app_components ++ hologram_ui_components
  end

  def list_layouts(opts \\ []) do
    app_path = app_path(opts)
    list_modules_of_type(:layout, app_path)
  end

  defp list_modules_of_type(type, path, app \\ @config[:otp_app]) do
    :ok = Application.ensure_loaded(app)
    modules = Keyword.fetch!(Application.spec(app), :modules)

    Enum.reduce(modules, [], fn module, acc ->
      case Code.ensure_loaded(module) do
        {:module, _} ->
          funs = module.module_info(:exports)
          in_path? = String.starts_with?(source_path(module), path)
          type_check_function = :"is_#{type}?"

          if Keyword.get(funs, type_check_function) && apply(module, type_check_function, []) &&
               in_path? do
            acc ++ [module]
          else
            acc
          end

        _ ->
          acc
      end
    end)
  end

  def list_pages(opts \\ []) do
    app_path = app_path(opts)
    list_modules_of_type(:page, app_path)
  end

  # DEFER: test
  def list_templatables(opts \\ []) do
    list_pages(opts) ++ list_components(opts) ++ list_layouts(opts)
  end

  def list_templates(templatables) do
    Enum.map(templatables, &{&1, &1.template()})
  end

  # DEFER: instead of matching the macro on arity, pattern match the args as well
  def macro_definition(module, name, args) do
    arity = Enum.count(args)

    module_definition(module).macros
    |> Enum.filter(&(&1.name == name && &1.arity == arity))
    |> hd()
  end

  def macros(module) do
    module.__info__(:macros)
  end

  # DEFER: test
  def mix_lock_path(opts \\ []) do
    root_path(opts) <> "/mix.lock"
  end

  # DEFER: test
  def mix_path(opts \\ []) do
    root_path(opts) <> "/mix.exs"
  end

  @doc """
  Returns the corresponding module definition.

  ## Examples
      iex> Reflection.get_module_definition(Abc.Bcd)
      %ModuleDefinition{module: Abc.Bcd, ...}
  """
  @spec module_definition(module()) :: %ModuleDefinition{}

  def module_definition(module) do
    ast(module)
    |> Transformer.transform(%Context{})
  end

  def otp_app do
    @config[:otp_app]
  end

  # DEFER: test
  def release_page_digest_store_path do
    release_priv_path() <> "/hologram/page_digest_store.bin"
  end

  # DEFER: test
  def release_page_list_path do
    release_priv_path() <> "/hologram/page_list.bin"
  end

  # DEFER: test
  def root_page_digest_store_path(opts \\ []) do
    root_priv_path(opts) <> "/page_digest_store.bin"
  end

  # DEFER: test
  def root_page_list_path() do
    root_priv_path() <> "/page_list.bin"
  end

  # DEFER: test
  def root_source_digest_path(opts \\ []) do
    root_priv_path(opts) <> "/source_digest.bin"
  end

  # TODO: test
  def root_static_path(opts \\ []) do
    root_priv_path(opts) <> "/static"
  end

  def source_code(module) do
    source_path(module) |> File.read!()
  end

  def standard_lib?(module) do
    source_path = source_path(module)
    root_path = root_path()
    app_path = app_path()

    !String.starts_with?(source_path, "#{app_path}/") &&
      !String.starts_with?(source_path, "#{root_path}/lib/") &&
      !String.starts_with?(source_path, "#{root_path}/test/") &&
      !String.starts_with?(source_path, "#{root_path}/deps/")
  end
end
