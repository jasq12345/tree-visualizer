from backend.models.tree import Node


def calculate_tree_height(node: Node | None) -> int:
    if node is None:
        return 0
    return 1 + max(calculate_tree_height(node.left), calculate_tree_height(node.right))
