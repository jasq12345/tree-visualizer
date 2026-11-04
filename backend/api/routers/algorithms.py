from fastapi import APIRouter, HTTPException

from models.requests import TreeRequest
from models.responses import AlgorithmResult
from models.tree import BinaryTree
from services.algorithm_provider import ALGORITHMS

router = APIRouter(prefix="/algorithms", tags=["algorithms"])


@router.get("")
def list_algorithms() -> list[str]:
    return list(ALGORITHMS)


@router.post("/{name}")
def run_algorithm(name: str, request: TreeRequest) -> AlgorithmResult:
    algorithm = ALGORITHMS.get(name)
    if algorithm is None:
        raise HTTPException(status_code=404, detail=f"Unknown algorithm: {name}")
    tree = BinaryTree.from_values(request.values)
    return AlgorithmResult(tree=tree, steps=algorithm(tree))
