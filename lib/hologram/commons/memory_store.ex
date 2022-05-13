defmodule Hologram.Commons.MemoryStore do
  defmacro __using__(_opts) do
    quote do
      use GenServer
      alias Hologram.Utils

      @behaviour Hologram.Commons.MemoryStore

      def run do
        start_link(nil)
      end

      def start_link(_opts) do
        GenServer.start_link(__MODULE__, [], name: __MODULE__)
      end

      @impl true
      def init(_state) do
        maybe_create_table()
        reload()
        {:ok, nil}
      end

      def populate_table, do: nil

      @impl true
      def terminate(_reason, _state) do
        delete_table()
      end

      defp create_table do
        table_name() |> :ets.new([:public, :named_table])
      end

      defp delete_table do
        table_name() |> :ets.delete()
      end

      def get(key) do
        case :ets.lookup(table_name(), key) do
          [{^key, value}] ->
            {:ok, value}

          _ ->
            :error
        end
      end

      def get!(key) do
        case get(key) do
          {:ok, value} ->
            value

          :error ->
            raise KeyError, message: "key #{inspect(key)} not found"
        end
      end

      def get_all do
        table_name()
        |> :ets.tab2list()
        |> Enum.into(%{})
      end

      defp maybe_create_table do
        if !table_created?(), do: create_table()
      end

      def maybe_stop do
        if running?(), do: stop()
      end

      defp populate_table_from_file(file_path) do
        file_path
        |> File.read!()
        |> Utils.deserialize()
        |> Enum.each(fn {key, value} -> put(key, value) end)
      end

      def put(items) do
        table_name() |> :ets.insert(items)
      end
      
      def put(key, value) do
        table_name() |> :ets.insert({key, value})
      end

      def reload do
        truncate_table()
        populate_table()
      end

      def running? do
        pid = Process.whereis(__MODULE__)
        if pid, do: Process.alive?(pid), else: false
      end

      def stop do
        GenServer.stop(__MODULE__)
      end

      defp table_created? do
        table_name() |> :ets.info() != :undefined
      end

      defp truncate_table do
        table_name() |> :ets.delete_all_objects()
      end

      defoverridable populate_table: 0
    end
  end

  @callback populate_table() :: any()
  @callback table_name() :: atom()
end
