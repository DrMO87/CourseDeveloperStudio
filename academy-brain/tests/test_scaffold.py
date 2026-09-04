def test_swarm_package_importable():
    import swarm
    assert swarm.__version__ == "0.1.0"
