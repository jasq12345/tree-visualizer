from fastapi import APIRouter, HTTPException

from models.requests import TreeRequest
from models.responses import AlgorithmInfo, AlgorithmResult
from models.tree import BinaryTree
from services.algorithm_provider import ALGORITHMS
from services.layout import compute_layout

router = APIRouter(prefix="/algorithms", tags=["algorithms"])


@router.get("")
def list_algorithms() -> list[AlgorithmInfo]:
    return [AlgorithmInfo(name=name, needs_target=spec.needs_target) for name, spec in ALGORITHMS.items()]


@router.post("/{name}")
def run_algorithm(name: str, request: TreeRequest) -> AlgorithmResult:
    spec = ALGORITHMS.get(name)
    if spec is None:
        raise HTTPException(status_code=404, detail=f"Unknown algorithm: {name}")
    if spec.needs_target and request.target is None:
        raise HTTPException(status_code=422, detail=f"{name} requires a target")
    tree = BinaryTree.from_values(request.values)
    steps, result = spec.algorithm(tree, request.target)
    return AlgorithmResult(tree=tree, layout=compute_layout(tree), steps=steps, result=result)
