from models.tree import BinaryTree, Node


def bst_search(
    tree: BinaryTree,
    target: int | None = None,
) -> tuple[list[int], int | None]:
    steps: list[int] = []
    node: Node | None = tree.root

    while node is not None:
        steps.append(node.value)

        if target is None or node.value == target:
            return steps, node.value if target is not None else None

        if target < node.value:
            node = node.left
        else:
            node = node.right

    return steps, None