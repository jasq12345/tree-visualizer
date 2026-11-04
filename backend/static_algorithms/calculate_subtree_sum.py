from models.tree import Node


def calculate_subtree_sum(node: Node | None) -> int:
    if node is None:
        return 0
    return node.value + calculate_subtree_sum(node.left) + calculate_subtree_sum(node.right)
