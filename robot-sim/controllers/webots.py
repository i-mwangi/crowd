import os

from flask import Flask, request, jsonify

# Create a new Flask application instance
app = Flask(__name__)

# Robot readiness is tracked in per-controller state files:
#   "1" = idle and ready for a command   (written by the controller at startup)
#   "2" = command pending                (written here)
#   "0" = task finished                  (written by the controller)
STATE_FILES = {
    1: 'robot_1_controller/state.txt',
    2: 'robot_2_controller/state.txt',
    3: 'robot_3_controller/state.txt',
}


def read_state(robot):
    try:
        with open(STATE_FILES[robot], 'r') as state_file:
            return state_file.read().strip()
    except FileNotFoundError:
        return None


# Health check — confirms this server is reachable and reports which robots
# are ready. Use it to verify the tunnel before running an order.
@app.route('/')
def health():
    labels = {'0': 'finished', '1': 'ready', '2': 'busy'}
    robots = {
        f'robot_{n}': labels.get(read_state(n), 'unknown (Webots not running?)')
        for n in STATE_FILES
    }
    return jsonify({
        'service': 'crowd connectivity layer',
        'cwd': os.getcwd(),
        'robots': robots,
    }), 200

# Define a POST route for the API endpoint /api/scenario1
@app.route('/api/scenario1', methods=['POST'])
def scenario1():
    try:
        # Retrieve JSON data from the incoming request
        data = request.json
        order_id = data.get('orderId')
        robot_id = data.get('robotId')
        product_id = data.get('productId')

        # Open the state file for reading and writing
        with open('robot_1_controller/state.txt', 'r+') as state_file:
            state_content = state_file.read()
            
            # Check if the state is "1"
            if state_content == "1":
                # Example logic to write different values to a file based on product_id
                with open('color.txt', 'w') as color_file:
                    if product_id == 1:
                        color_file.write("15")
                    elif product_id == 0:
                        color_file.write("13")
                    elif product_id == 2:
                        color_file.write("14")
                    else:
                        # Return an error if the productId is invalid
                        return jsonify({"error": "Invalid productId"}), 500
                
                # Update the state file to "2"
                state_file.seek(0)
                state_file.write("2")
                state_file.truncate()  # Ensure the file size is truncated to the new size
                
                # Write the order_id to a separate file
                with open('order.txt', 'w') as file:
                    file.write(order_id)
                
                with open('robot.txt', 'w') as file:
                    file.write(f"{robot_id}")

                # Return a success response
                return jsonify({"state": "Success"}), 200
            else:
                # Return an error if the state is not "1"
                return jsonify({"error": "Webots down"}), 500

    except Exception as e:
        # Handle any exceptions that occur during the process
        return jsonify({"error": str(e)}), 500

# Define a POST route for the API endpoint /api/scenario2
@app.route('/api/scenario2', methods=['POST'])
def scenario2():
    try:
        # Retrieve JSON data from the incoming request
        data = request.json
        order_id = data.get('orderId')
        robot_id = data.get('robotId')
        
        # Open the state file for robot 2
        with open('robot_2_controller/state.txt', 'r+') as state_file:
            state_content = state_file.read()
            
            # Check if the state is "1"
            if state_content == "1":
                # Update the state file to "2"
                state_file.seek(0)
                state_file.write("2")
                state_file.truncate()  # Ensure the file size is truncated to the new size
                
                # Write the order_id to a separate file
                with open('order.txt', 'w') as file:
                    file.write(order_id)
                
                with open('robot.txt', 'w') as file:
                    file.write(f"{robot_id}")

                # Return a success response
                return jsonify({"state": "Success"}), 200
            else:
                # Return an error if the state is not "1"
                return jsonify({"error": "Webots down"}), 500

    except Exception as e:
        # Handle any exceptions that occur during the process
        return jsonify({"error": str(e)}), 500

# Define a POST route for the API endpoint /api/scenario3
@app.route('/api/scenario3', methods=['POST'])
def scenario3():
    try:
        # Retrieve JSON data from the incoming request
        data = request.json
        order_id = data.get('orderId')
        robot_id = data.get('robotId')

        # Open the state file for robot 3
        with open('robot_3_controller/state.txt', 'r+') as state_file:
            state_content = state_file.read()
            
            # Check if the state is "1"
            if state_content == "1":
                # Update the state file to "2"
                state_file.seek(0)
                state_file.write("2")
                state_file.truncate()  # Ensure the file size is truncated to the new size
                
                # Write the order_id to a separate file
                with open('order.txt', 'w') as file:
                    file.write(order_id)
                
                with open('robot.txt', 'w') as file:
                    file.write(f"{robot_id}")

                # Return a success response
                return jsonify({"state": "Success"}), 200
            else:
                # Return an error if the state is not "1"
                return jsonify({"error": "Webots down"}), 500

    except Exception as e:
        # Handle any exceptions that occur during the process
        return jsonify({"error": str(e)}), 500
"""
# Define a POST route for the API endpoint /api/robot
@app.route('/api/robot', methods=['POST'])
def feedback():
    try:
        # Retrieve JSON data from the incoming request
        data = request.json
        order_id = data.get('orderId')
        robot_id = data.get('robotId')

        # Print the order_id and robot_id to the console
        print(order_id, " ", robot_id)        
        
        # Return a success response
        return jsonify({"state": "Success"}), 200
            
    except Exception as e:
        # Handle any exceptions that occur during the process
        return jsonify({"error": str(e)}), 500
"""
# Run the Flask application
if __name__ == '__main__':
    app.run()
