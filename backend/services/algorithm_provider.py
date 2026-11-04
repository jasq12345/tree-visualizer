from collections.abc import Callable
from typing import Any

from pydantic import BaseModel

from models.tree import BinaryTree
from static_algorithms.inorder import inorder_recursive
from static_algorithms.preorder import preorder_recursive
from static_algorithms.postorder import postorder_recursive
from static_algorithms.bfs import bfs_traversal
from static_algorithms.bst_search import bst_search
from static_algorithms.calculate_subtree_sum import calculate_subtree_sum
from static_algorithms.calculate_tree_height import calculate_tree_height
from static_algorithms.count_nodes_and_leaves import count_nodes_and_leaves
from static_algorithms.dfs_search import dfs_search

# (tree, target) -> (steps, result)
Algorithm = Callable[[BinaryTree, int | None], tuple[list[int], Any]]
class AlgorithmSpec(BaseModel):
    algorithm: Algorithm
    needs_target: bool

ALGORITHMS: dict[str, AlgorithmSpec] = {
    "inorder": AlgorithmSpec(algorithm=inorder_recursive, needs_target=False),
    "preorder": AlgorithmSpec(algorithm=preorder_recursive, needs_target=False),
    "postorder": AlgorithmSpec(algorithm=postorder_recursive, needs_target=False),
    "bfs": AlgorithmSpec(algorithm=bfs_traversal, needs_target=False),
    "bst_search": AlgorithmSpec(algorithm=bst_search, needs_target=True),
    "calculate_subtree_sum": AlgorithmSpec(algorithm=calculate_subtree_sum, needs_target=False),
    "calculate_tree_height": AlgorithmSpec(algorithm=calculate_tree_height, needs_target=False),
    "count_nodes_and_leaves": AlgorithmSpec(algorithm=count_nodes_and_leaves, needs_target=False),
    "dfs_search": AlgorithmSpec(algorithm=dfs_search, needs_target=True),
}
