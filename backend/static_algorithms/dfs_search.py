from backend.models.tree import Node


def dfs_search(node: Node | None, target: int) -> Node | None:
    if node is None:
        return None
    if node.value == target:
        return node
    return dfs_search(node.left, target) or dfs_search(node.right, target)
