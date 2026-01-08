# backend/hr/utils.py

import ast
import operator
from decimal import Decimal

# Safe operators for formula evaluation
SAFE_OPERATORS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
}

def safe_eval_formula(formula: str, context: dict) -> Decimal:
    """
    Safely evaluate a simple math formula using only allowed operations.
    Supports: +, -, *, /, numbers, and component codes from context.
    Example: "BASIC * 0.4" or "IF(GROSS_MONTHLY < 21000, GROSS_MONTHLY * 0.0325, 0)"
    """
    if not formula or not formula.strip():
        return Decimal('0')

    formula = formula.strip()

    # Handle simple number
    if formula.replace('.', '', 1).replace('-', '', 1).isdigit():
        return Decimal(formula)

    try:
        node = ast.parse(formula, mode='eval').body

        def _eval(node):
            # Number
            if isinstance(node, ast.Constant):
                return Decimal(str(node.value))
            if isinstance(node, ast.Num):  # Backward compat
                return Decimal(str(node.n))

            # Variable from context (e.g., BASIC, CTC)
            if isinstance(node, ast.Name):
                return context.get(node.id, Decimal('0'))

            # Binary operations: +, -, *, /
            if isinstance(node, ast.BinOp):
                if type(node.op) not in SAFE_OPERATORS:
                    return Decimal('0')
                left = _eval(node.left)
                right = _eval(node.right)
                return SAFE_OPERATORS[type(node.op)](left, right)

            # Simple IF support: IF(condition, true_value, false_value)
            if isinstance(node, ast.Call) and getattr(node.func, 'id', None) == 'IF':
                if len(node.args) != 3:
                    return Decimal('0')
                condition = _eval(node.args[0])
                true_val = _eval(node.args[1])
                false_val = _eval(node.args[2])
                return true_val if condition != Decimal('0') else false_val

            return Decimal('0')

        return _eval(node)
    except Exception:
        return Decimal('0')


# Optional: Move calculate_breakdown here too (recommended)
def calculate_breakdown(total_annual_ctc: Decimal, manual_overrides: dict = None) -> dict:
    """
    Main function to calculate full CTC breakdown using active CTCComponent rules.
    Call this when creating/updating a Contract.
    """
    from .models import CTCComponent  # Import here to avoid circular import

    manual_overrides = manual_overrides or {}
    components = CTCComponent.objects.filter(is_active=True).order_by('order')

    context = {'CTC': total_annual_ctc}
    breakdown = {}

    for comp in components:
        if comp.code in manual_overrides:
            value = Decimal(str(manual_overrides[comp.code]))
        else:
            value = safe_eval_formula(comp.formula or "0", context)

        # Store as float for JSON compatibility
        breakdown[comp.code] = float(value.quantize(Decimal('0.01')))
        context[comp.code] = value  # Make available for dependent formulas

    return breakdown