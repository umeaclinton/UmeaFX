"""
UmeaFX Client Configuration and Web Sync Models
"""

import json
import urllib.request
import urllib.error
from pathlib import Path
from typing import List, Optional
from pydantic import BaseModel, Field

CONFIG_DIR = Path(__file__).parent / "config"
CONFIG_FILE = CONFIG_DIR / "clients.json"


class ClientAccount(BaseModel):
    client_id: str = Field(..., description="Unique client identifier (e.g., CLI-001)")
    name: str = Field(..., description="Client Name or Label")
    login: int = Field(..., description="MT5 Account Login ID")
    password: str = Field(..., description="MT5 Master/Trade Password")
    server: str = Field(default="Weltrade-Real", description="MT5 Server Name")
    risk_mode: str = Field(default="multiplier", description="'multiplier', 'fixed', or 'risk_percent'")
    risk_value: float = Field(default=1.0, description="Multiplier (1.0 = match master), fixed lot (e.g. 0.02), or risk %")
    max_lot: float = Field(default=5.0, description="Max lot safety cap")
    is_active: bool = Field(default=True, description="Enable or pause copying for this client")
    notes: Optional[str] = Field(default="", description="Internal notes / subscription expiry")


class MasterConfig(BaseModel):
    login: int = Field(default=0, description="Master account login (0 to auto-detect current connected)")
    server: str = Field(default="Weltrade-Real", description="Master MT5 server name")
    symbol: str = Field(default="FX Vol 60", description="Target Symbol to copy")
    poll_interval_ms: int = Field(default=100, description="Polling interval in milliseconds")
    magic_number: int = Field(default=606060, description="UMEA EA Magic Number")


def fetch_cloud_clients(api_url: str = "http://localhost:3000/api/clients", api_key: str = "umea-fx60-secret-bridge-key") -> List[ClientAccount]:
    """Fetch live paying and trial clients from the cloud web application."""
    try:
        url = f"{api_url}?key={api_key}"
        req = urllib.request.Request(url, headers={"User-Agent": "UmeaCopierEngine/2.20"})
        with urllib.request.urlopen(req, timeout=5) as response:
            if response.status == 200:
                data = json.loads(response.read().decode())
                cloud_clients = []
                for c in data.get("clients", []):
                    cloud_clients.append(
                        ClientAccount(
                            client_id=c.get("clientId") or f"CLI-{c.get('login')}",
                            name=c.get("name", "Web Client"),
                            login=int(c.get("login")),
                            password=c.get("password"),
                            server=c.get("server", "Weltrade-Real"),
                            risk_mode=c.get("riskMode", "multiplier"),
                            risk_value=float(c.get("riskValue", 1.0)),
                            max_lot=float(c.get("maxLot", 5.0)),
                            is_active=c.get("isActive", True),
                            notes=f"Plan: {c.get('plan', 'trial')} | Cloud Synced",
                        )
                    )
                if cloud_clients:
                    # Save a copy locally as cache
                    save_clients(cloud_clients)
                    return cloud_clients
    except Exception:
        pass
    # Fallback to local configuration file
    return load_clients()


def load_clients() -> List[ClientAccount]:
    if not CONFIG_FILE.exists():
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        default_clients = [
            ClientAccount(
                client_id="DEMO-001",
                name="Demo Client 1",
                login=43259134,
                password="YourPasswordHere",
                server="Weltrade-Demo",
                risk_mode="multiplier",
                risk_value=1.0,
                max_lot=2.0,
                is_active=False,
                notes="Sample client config"
            )
        ]
        save_clients(default_clients)
        return default_clients

    with open(CONFIG_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
        return [ClientAccount(**c) for c in data.get("clients", [])]


def save_clients(clients: List[ClientAccount]) -> None:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump({"clients": [c.model_dump() for c in clients]}, f, indent=2)
