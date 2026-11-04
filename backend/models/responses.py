from pydantic import BaseModel

from models.tree import BinaryTree


class AlgorithmResult(BaseModel):
    tree: BinaryTree
    steps: list[int]
