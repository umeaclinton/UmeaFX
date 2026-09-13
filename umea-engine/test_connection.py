import sys
from pathlib import Path
import MetaTrader5 as mt5
from rich.console import Console
from rich.table import Table
from rich.panel import Panel

console = Console()

def test_mt5():
    console.print(Panel.fit("[bold cyan]UmeaFX - MT5 Connection Diagnostic[/bold cyan]", border_style="cyan"))

    # Try default initialize first
    initialized = mt5.initialize()
    if not initialized:
        # Check standard installation locations if default fails
        standard_paths = [
            r"C:\Program Files\MetaTrader 5\terminal64.exe",
            r"C:\Program Files\FBS MetaTrader 5\terminal64.exe",
            r"C:\Program Files\HFM Metatrader 5\terminal64.exe"
        ]
        for path in standard_paths:
            if Path(path).exists():
                console.print(f"[yellow]Attempting connection using explicit path: {path}[/yellow]")
                initialized = mt5.initialize(path=path)
                if initialized:
                    break

    if not initialized:
        err = mt5.last_error()
        console.print(f"[bold red]Failed to initialize MT5:[/bold red] {err}")
        return False

    # Get terminal info
    term_info = mt5.terminal_info()
    version = mt5.version()
    account_info = mt5.account_info()

    table = Table(title="MetaTrader 5 Status", show_header=True, header_style="bold magenta")
    table.add_column("Property", style="dim", width=25)
    table.add_column("Value")

    table.add_row("MT5 Version", f"{version[0]} build {version[1]} ({version[2]})")
    table.add_row("Connected to Broker", str(term_info.connected if term_info else "Unknown"))
    table.add_row("Terminal Path", str(term_info.path if term_info else "Unknown"))
    table.add_row("Data Path", str(term_info.data_path if term_info else "Unknown"))

    if account_info:
        table.add_row("Account Login", str(account_info.login))
        table.add_row("Account Server", str(account_info.server))
        table.add_row("Currency / Leverage", f"{account_info.currency} / 1:{account_info.leverage}")
        table.add_row("Account Balance", f"{account_info.balance:.2f} {account_info.currency}")
        table.add_row("Account Equity", f"{account_info.equity:.2f} {account_info.currency}")
    else:
        table.add_row("Account Status", "[yellow]No account currently logged in[/yellow]")

    console.print(table)

    # Test symbol availability (XAUUSD / Gold)
    symbols_to_check = ["XAUUSD", "GOLD", "XAUUSDm", "XAUUSDb"]
    found_symbol = None
    for sym in symbols_to_check:
        sym_info = mt5.symbol_info(sym)
        if sym_info is not None:
            found_symbol = sym
            mt5.symbol_select(sym, True)
            console.print(f"[green]Found active Gold symbol:[/green] [bold]{sym}[/bold] (Digits: {sym_info.digits}, Spread: {sym_info.spread})")
            break

    if not found_symbol:
        console.print("[yellow]Note: XAUUSD not directly found with standard naming. Total symbols available:[/yellow]", mt5.symbols_total())

    mt5.shutdown()
    console.print("[bold green]MT5 API Connection Test Completed Successfully![/bold green]")
    return True

if __name__ == "__main__":
    test_mt5()
