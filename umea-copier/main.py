"""
UmeaFX Trade Copier - CLI Management & Live Dashboard
"""

import sys
import time
from pathlib import Path
from typing import Optional

from rich import print as rprint
from rich.console import Console
from rich.live import Live
from rich.panel import Panel
from rich.prompt import Confirm, FloatPrompt, IntPrompt, Prompt
from rich.table import Table

import logging
from config import ClientAccount, load_clients, save_clients
from engine import CopierEngine

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("UmeaCopier")

console = Console()


def display_clients_table():
    clients = load_clients()
    table = Table(title="[bold cyan]UmeaFX Copier - Registered Client Accounts[/bold cyan]", expand=True)
    table.add_column("Client ID", style="bold yellow")
    table.add_column("Name", style="white")
    table.add_column("Login", style="cyan")
    table.add_column("Server", style="magenta")
    table.add_column("Risk Mode", style="green")
    table.add_column("Risk Value", style="bold green")
    table.add_column("Max Lot", style="white")
    table.add_column("Status", style="bold")
    table.add_column("Notes", style="dim")

    for c in clients:
        status = "[green]ACTIVE[/green]" if c.is_active else "[red]PAUSED[/red]"
        table.add_row(
            c.client_id,
            c.name,
            str(c.login),
            c.server,
            c.risk_mode,
            str(c.risk_value),
            str(c.max_lot),
            status,
            c.notes or "",
        )
    console.print(table)


def add_client_interactive():
    console.print(Panel("[bold green]+ Add New Paying Client to UmeaFX Copier[/bold green]", expand=False))
    
    client_id = Prompt.ask("Enter unique Client ID (e.g. CLI-001)")
    name = Prompt.ask("Enter Client Name")
    login = IntPrompt.ask("Enter MT5 Login ID")
    password = Prompt.ask("Enter MT5 Trade Password", password=True)
    server = Prompt.ask("Enter MT5 Server Name", default="Weltrade-Real")
    
    risk_mode = Prompt.ask("Select Risk Mode", choices=["multiplier", "fixed", "risk_percent"], default="multiplier")
    risk_value = FloatPrompt.ask("Enter Risk Value (e.g., 1.0 for 1x master lot, 0.02 for fixed lot)", default=1.0)
    max_lot = FloatPrompt.ask("Enter Max Lot Safety Cap", default=5.0)
    notes = Prompt.ask("Internal Notes (optional)", default="")

    new_client = ClientAccount(
        client_id=client_id,
        name=name,
        login=login,
        password=password,
        server=server,
        risk_mode=risk_mode,
        risk_value=risk_value,
        max_lot=max_lot,
        is_active=True,
        notes=notes,
    )

    clients = load_clients()
    clients.append(new_client)
    save_clients(clients)
    rprint(f"\n[bold green]✅ Successfully added Client {name} ({client_id})![/bold green]\n")


def toggle_client_status():
    display_clients_table()
    client_id = Prompt.ask("Enter Client ID to toggle (Active/Paused)")
    clients = load_clients()
    found = False
    for c in clients:
        if c.client_id.upper() == client_id.upper():
            c.is_active = not c.is_active
            found = True
            status = "ACTIVE" if c.is_active else "PAUSED"
            rprint(f"[bold green]Updated {c.name} ({c.client_id}) status to: {status}[/bold green]")
            break
    if not found:
        rprint("[bold red]Client ID not found![/bold red]")
    else:
        save_clients(clients)


def run_copier_service():
    from config import load_master_config, save_master_config

    engine = CopierEngine(symbol="FX Vol 60")
    if not engine.init_terminal():
        rprint("[bold red]Could not connect to MT5 terminal. Make sure MT5 is running![/bold red]")
        return

    engine.reload_clients()
    acc = engine.get_account_info()
    if not acc:
        rprint("[bold red]Could not read Master Account Info.[/bold red]")
        return

    master_cfg = load_master_config()
    # If saved login matches or not configured, use current terminal account
    if master_cfg.login == 0 or master_cfg.login != acc["login"]:
        master_cfg.login = acc["login"]
        master_cfg.server = acc["server"]

    # Check if we have password for master account to enable seamless restoration
    if not master_cfg.password:
        rprint(Panel(
            f"[bold yellow]Master Account Session Lock Protection[/bold yellow]\n\n"
            f"Detected Master Account: [bold cyan]{acc['login']}[/bold cyan] on [bold magenta]{acc['server']}[/bold magenta]\n"
            f"To prevent MT5 from staying logged into a client account after copying a trade,\n"
            f"enter the master account password (saved locally in [dim]config/master.json[/dim]):",
            title="[bold yellow]MASTER ACCOUNT SETUP[/bold yellow]"
        ))
        pwd = Prompt.ask("Enter Master MT5 Trade Password", password=True)
        if pwd:
            master_cfg.password = pwd
            save_master_config(master_cfg)
            rprint("[bold green]✅ Master credentials saved for auto-session restore.[/bold green]")

    rprint(Panel(f"[bold cyan]UmeaFX High-Speed Trade Copier Running[/bold cyan]\n"
                 f"Master Login: [bold yellow]{acc['login']}[/bold yellow] | Server: [bold magenta]{acc['server']}[/bold magenta]\n"
                 f"Balance: [bold green]${acc['balance']:.2f}[/bold green] | Active Clients: [bold cyan]{len(engine.clients)}[/bold cyan]\n"
                 f"Monitoring Symbol: [bold yellow]FX Vol 60[/bold yellow] | Interval: [dim]100ms[/dim]\n"
                 f"Master Auto-Restore: [bold green]{'ENABLED' if master_cfg.password else 'DISABLED (Password needed)'}[/bold green]",
                 title="[bold green]SERVICE ONLINE[/bold green]"))

    rprint("[dim]Press Ctrl+C to stop copier service anytime.[/dim]\n")

    try:
        while True:
            engine.sync_cycle(master_login=acc["login"], master_pwd=master_cfg.password, master_server=acc["server"])
            time.sleep(0.1)
    except KeyboardInterrupt:
        rprint("\n[bold yellow]Copier service stopped by user.[/bold yellow]")


def main_menu():
    while True:
        console.print("\n[bold cyan]═══════════════════════════════════════════[/bold cyan]")
        console.print("[bold cyan]       UmeaFX Local Trade Copier Hub       [/bold cyan]")
        console.print("[bold cyan]═══════════════════════════════════════════[/bold cyan]")
        console.print("1. [bold green]Start Copier Service[/bold green] (Monitor & Copy Master Trades)")
        console.print("2. [white]List All Client Accounts[/white]")
        console.print("3. [bold yellow]+ Add New Client Account[/bold yellow]")
        console.print("4. [cyan]Toggle Client Active / Paused[/cyan]")
        console.print("5. [bold red]Exit[/bold red]")
        
        choice = Prompt.ask("\nSelect an option", choices=["1", "2", "3", "4", "5"], default="1")
        
        if choice == "1":
            run_copier_service()
        elif choice == "2":
            display_clients_table()
        elif choice == "3":
            add_client_interactive()
        elif choice == "4":
            toggle_client_status()
        elif choice == "5":
            rprint("[bold cyan]Goodbye![/bold cyan]")
            break


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--start":
        run_copier_service()
    else:
        main_menu()
