from typing import Self

from pydantic import BaseModel, Field, model_validator


class Node(BaseModel):
    value: int
    parent: "Node | None" = Field(default=None, exclude=True, repr=False)
    left: "Node | None" = None
    right: "Node | None" = None

    def __eq__(self, other: object) -> bool:
        # Compare structure only, going up through parent would recurse forever
        if not isinstance(other, Node):
            return NotImplemented
        return (self.value, self.left, self.right) == (other.value, other.left, other.right)


class BinaryTree(BaseModel):
    root: "Node | None" = None

    @model_validator(mode="after")
    def _link_parents(self) -> Self:
        # A tree loaded from JSON has no parent references, so restore them
        stack = [self.root] if self.root is not None else []
        while stack:
            node = stack.pop()
            for child in (node.left, node.right):
                if child is not None:
                    child.parent = node
                    stack.append(child)
        return self

    @classmethod
    def from_values(cls, values: list[int]) -> Self:
        """Build the tree from values in order; the first one becomes the root."""
        tree = cls()
        if not values:
            return tree

        root = Node(value=values[0])
        tree.root = root

        for value in values[1:]:
            current = root
            while True:
                if value > current.value:
                    if current.right is None:
                        current.right = Node(value=value, parent=current)
                        break
                    current = current.right
                else:
                    if current.left is None:
                        current.left = Node(value=value, parent=current)
                        break
                    current = current.left
        return tree
