from app import create_app

app = create_app()

if __name__ == '__main__':
    # Run the app, listening on all interfaces (0.0.0.0) so it's accessible on the local network
    app.run(host='0.0.0.0', port=5000, debug=True) 