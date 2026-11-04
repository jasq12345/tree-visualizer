from collections.abc import Callable

from models.tree import BinaryTree
from static_algorithms.inorder import inorder_recursive

Algorithm = Callable[[BinaryTree], list[int]]

ALGORITHMS: dict[str, Algorithm] = {
    "inorder": inorder_recursive,
}
