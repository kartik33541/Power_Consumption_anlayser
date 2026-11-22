"""
End-to-end inference pipeline.
Operates on an incoming canonical SignalRecord to predict active appliance.
"""

from typing import Any, Dict, Optional
from datasets.base import SignalRecord
from preprocessing.cleaning import clean_signal
from features.pipeline import FeaturePipeline


class InferencePipeline:
    """Inference runner accepting canonical SignalRecords."""

    def __init__(self, model: Any, config: Optional[Dict[str, Any]] = None):
        self.model = model
        self.config = config or {}
        self.feature_pipeline = FeaturePipeline(self.config)

    def predict_record(self, record: SignalRecord) -> Dict[str, Any]:
        """Runs clean -> feature -> model inference."""
        cleaned = clean_signal(record)
        features, feature_names = self.feature_pipeline.extract_features(cleaned)
        
        # Reshape to 2D for model
        X = features.reshape(1, -1)
        pred = self.model.predict(X)[0] if hasattr(self.model, "predict") else "UNKNOWN"

        return {
            "signal_id": record.signal_id,
            "prediction": pred,
            "feature_count": len(features),
        }
