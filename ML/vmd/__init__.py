"""
VMD (Variational Mode Decomposition) package.
Decomposes canonical electrical current signals into constituent modes.
"""

from .decomposition import run_vmd
from .mode_ordering import order_modes
from .reconstruction import verify_reconstruction

__all__ = ["run_vmd", "order_modes", "verify_reconstruction"]
