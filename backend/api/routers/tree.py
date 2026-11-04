from fastapi import APIRouter

from models.requests import TreeRequest
from models.tree import BinaryTree

router = APIRouter(prefix="/tree", tags=["tree"])


@router.post("")
def build_tree(request: TreeRequest) -> BinaryTree:
    return BinaryTree.from_values(request.values)
