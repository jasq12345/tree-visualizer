from models.tree import Node, BinaryTree

def preorder_recursive(root_or_tree):
    root = root_or_tree.root if isinstance(root_or_tree, BinaryTree) else root_or_tree
    result = []  
    def traverse(node):
        if node:
            result.append(node.value)
            traverse(node.left)        
            traverse(node.right)              
    traverse(root)
    return result
