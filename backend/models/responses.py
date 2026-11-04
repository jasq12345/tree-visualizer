from typing import Any

from pydantic import BaseModel

from models.tree import BinaryTree


class AlgorithmInfo(BaseModel):
    name: str
    needs_target: bool


class LayoutNode(BaseModel):
    value: int
    x: int
    y: int


class Layout(BaseModel):
    nodes: list[LayoutNode]
    # [parent, child] pairs
    edges: list[tuple[int, int]]


class TreeView(BaseModel):
    tree: BinaryTree
    layout: Layout


class AlgorithmResult(TreeView):
    steps: list[int]
    result: Any = None
