from fastapi import APIRouter

from models.requests import TreeRequest
from models.responses import TreeView
from models.tree import BinaryTree
from services.layout import compute_layout

router = APIRouter(prefix="/tree", tags=["tree"])


@router.post("")
def build_tree(request: TreeRequest) -> TreeView:
    tree = BinaryTree.from_values(request.values)
    return TreeView(tree=tree, layout=compute_layout(tree))
