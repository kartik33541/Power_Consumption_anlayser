"""
Feature extraction package for NILM power consumption analysis.
Provides multi-domain feature extractors across electrical, time, spectral, and VMD sub-bands.
"""

from .electrical import extract_electrical_features
from .time_domain import extract_time_features
from .frequency_domain import extract_frequency_features
from .vmd_features import extract_vmd_features
from .pipeline import FeaturePipeline

__all__ = [
    "extract_electrical_features",
    "extract_time_features",
    "extract_frequency_features",
    "extract_vmd_features",
    "FeaturePipeline",
]
