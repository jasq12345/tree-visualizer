from models.tree import Node


def bst_search(node: Node | None, target: int) -> Node | None:
    if node is None or node.value == target:
        return node
    if target < node.value:
        return bst_search(node.left, target)
    return bst_search(node.right, target)
#t